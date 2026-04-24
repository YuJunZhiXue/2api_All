package gateway

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
	"sync"

	"nvidia-api-gateway/pkg/scheduler"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

var (
	bufferPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, 4096)
		},
	}
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

// acquireKeyWithQueue waits in a loop for an available key.
// It sends SSE keep-alive pings every 15 seconds if flusher is provided.
func (g *Gateway) acquireKeyWithQueue(ctx context.Context, w http.ResponseWriter, flusher http.Flusher) (string, error) {
	timeout := time.After(45 * time.Second) // Max wait time in queue
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	// Initial immediate attempt
	key, err := g.scheduler.AcquireKey(ctx, 3)
	if err != nil {
		return "", err
	}
	if key != "" {
		return key, nil
	}

	// We are queued
	// Write initial headers for SSE if we are waiting, so client knows connection is alive
	if flusher != nil {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()
	}

	pollTicker := time.NewTicker(500 * time.Millisecond) // Poll Redis for keys
	defer pollTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-timeout:
			return "", fmt.Errorf("queue timeout")
		case <-ticker.C:
			// Send keep-alive
			if flusher != nil {
				w.Write([]byte(": keep-alive\n\n"))
				flusher.Flush()
			}
		case <-pollTicker.C:
			key, err := g.scheduler.AcquireKey(ctx, 3)
			if err != nil {
				return "", err
			}
			if key != "" {
				return key, nil
			}
		}
	}
}

func (g *Gateway) HandleChatCompletions(c *fiber.Ctx) error {
	rawBody := c.Body()

	// 1. Translate and Strip Body
	newBody, promptStr, temperature, err := TranslateRequest(rawBody)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body format"})
	}

	// 2. Token Estimate
	estTokens := EstimateTokens(promptStr)
	if estTokens > 100000 { // example hard limit
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "Token limit exceeded"})
	}

	_ = temperature // TODO: Semantic Caching logic

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		flusher, ok := w.(http.Flusher)
		var lastErr error

		// Outer loop for cross-key retries
		for i := 0; i < 5; i++ {
			// Queue & Wait for Key
			key, err := g.acquireKeyWithQueue(ctx, w, flusher)
			if err != nil {
				if err.Error() == "queue timeout" {
					if !ok { // If we didn't start SSE, return 503
						http.Error(w, "Queue timeout, no available keys", http.StatusServiceUnavailable)
					} else {
						// Stream already started, inject error
						w.Write([]byte("\n\ndata: {\"error\": \"[QUEUE_TIMEOUT]\"}\n\n"))
						flusher.Flush()
					}
					return
				}
				continue
			}

			// Build Request
			req, err := http.NewRequestWithContext(ctx, "POST", "https://integrate.api.nvidia.com/v1/chat/completions", bytes.NewReader(newBody))
			if err != nil {
				g.scheduler.ReleaseKey(ctx, key)
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+key)
			req.Header.Set("Accept", "text/event-stream")

			// Do Request
			resp, err := g.client.Do(req)
			if err != nil {
				g.scheduler.ReleaseKey(ctx, key)
				lastErr = err
				time.Sleep(500 * time.Millisecond)
				continue
			}

			// Pre-stream Failover
			if resp.StatusCode == 429 {
				resp.Body.Close()
				// Parse Retry-After header if exists
				retryAfter := 60 * time.Second
				if ra := resp.Header.Get("Retry-After"); ra != "" {
					if d, parseErr := time.ParseDuration(ra + "s"); parseErr == nil {
						retryAfter = d
					}
				}
				g.scheduler.MarkCooling(ctx, key, retryAfter)
				g.scheduler.ReleaseKey(ctx, key)
				continue
			}
			if resp.StatusCode == 401 || resp.StatusCode == 403 {
				resp.Body.Close()
				g.scheduler.MarkDead(ctx, key)
				g.scheduler.ReleaseKey(ctx, key)
				continue
			}

			// Proxy Response Headers
			// If we already wrote headers due to queue keep-alive, we can't write them again.
			// But Fiber handles headers safely in fasthttpadaptor mostly. 
			// We'll just stream the body.
			buf := bufferPool.Get().([]byte)
			defer bufferPool.Put(buf)

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
			return // Success!
		}

		if !ok {
			http.Error(w, fmt.Sprintf("All retries failed: %v", lastErr), http.StatusBadGateway)
		} else {
			w.Write([]byte(fmt.Sprintf("\n\ndata: {\"error\": \"[ALL_RETRIES_FAILED_EXHAUSTED]\"}\n\n")))
			flusher.Flush()
		}
	})

	fasthttpadaptor.NewFastHTTPHandler(handler)(c.Context())
	return nil
}
