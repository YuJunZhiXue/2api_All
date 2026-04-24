package gateway

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"nvidia-api-gateway/pkg/scheduler"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

type Gateway struct {
	scheduler *scheduler.Scheduler
	client    *http.Client
}

func NewGateway(sched *scheduler.Scheduler) *Gateway {
	return &Gateway{
		scheduler: sched,
		client: &http.Client{
			Timeout: 0, // No timeout for SSE
		},
	}
}

func (g *Gateway) HandleChatCompletions(c *fiber.Ctx) error {
	body := c.Body()

	// Convert fiber context to net/http handler to use stream proxy easily
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		maxRetries := 5
		var lastErr error

		for i := 0; i < maxRetries; i++ {
			key, err := g.scheduler.AcquireKey(ctx, 3) // Assume maxConcurrency = 3
			if err != nil {
				http.Error(w, "Failed to acquire key", http.StatusInternalServerError)
				return
			}
			if key == "" {
				// No keys available, should queue (simplified here, returning 503)
				http.Error(w, "No API keys available", http.StatusServiceUnavailable)
				return
			}

			req, err := http.NewRequestWithContext(ctx, "POST", "https://integrate.api.nvidia.com/v1/chat/completions", bytes.NewReader(body))
			if err != nil {
				g.scheduler.ReleaseKey(ctx, key)
				http.Error(w, "Failed to create request", http.StatusInternalServerError)
				return
			}

			// Copy relevant headers
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+key)
			req.Header.Set("Accept", "text/event-stream")

			resp, err := g.client.Do(req)
			if err != nil {
				g.scheduler.ReleaseKey(ctx, key)
				lastErr = err
				time.Sleep(500 * time.Millisecond)
				continue
			}

			// Handle pre-stream failover
			if resp.StatusCode == 429 {
				resp.Body.Close()
				g.scheduler.MarkCooling(ctx, key, 60*time.Second)
				g.scheduler.ReleaseKey(ctx, key)
				continue // retry
			}
			if resp.StatusCode == 401 || resp.StatusCode == 403 {
				resp.Body.Close()
				g.scheduler.MarkDead(ctx, key)
				g.scheduler.ReleaseKey(ctx, key)
				continue // retry
			}

			// Stream response back to client
			for k, vv := range resp.Header {
				for _, v := range vv {
					w.Header().Add(k, v)
				}
			}
			w.WriteHeader(resp.StatusCode)

			// SSE streaming
			flusher, ok := w.(http.Flusher)
			buf := make([]byte, 4096)
			for {
				n, readErr := resp.Body.Read(buf)
				if n > 0 {
					w.Write(buf[:n])
					if ok {
						flusher.Flush()
					}
				}
				if readErr != nil {
					if readErr == io.EOF {
						break
					}
					// Mid-stream interrupt
					errMsg := "\n\ndata: {\"error\": \"[STREAM_INTERRUPTED_BY_UPSTREAM]\"}\n\n"
					w.Write([]byte(errMsg))
					if ok {
						flusher.Flush()
					}
					break
				}
			}

			resp.Body.Close()
			g.scheduler.ReleaseKey(ctx, key)
			return // Success
		}

		if lastErr != nil {
			http.Error(w, fmt.Sprintf("All retries failed: %v", lastErr), http.StatusBadGateway)
		} else {
			http.Error(w, "Exceeded max retries due to upstream errors", http.StatusBadGateway)
		}
	})

	fasthttpadaptor.NewFastHTTPHandler(handler)(c.Context())
	return nil
}
