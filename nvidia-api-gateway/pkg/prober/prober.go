package prober

import (
	"context"
	"log"
	"net/http"
	"time"

	"nvidia-api-gateway/pkg/scheduler"

	"github.com/redis/go-redis/v9"
)

type Prober struct {
	client    *http.Client
	redis     *redis.Client
	scheduler *scheduler.Scheduler
}

func NewProber(redisClient *redis.Client, sched *scheduler.Scheduler) *Prober {
	return &Prober{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		redis:     redisClient,
		scheduler: sched,
	}
}

// Start runs in the background and periodically checks Dead keys
// to see if they can be resurrected (e.g., if it was a temporary ban or mistake).
func (p *Prober) Start(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.probeDeadKeys(ctx)
		}
	}
}

func (p *Prober) probeDeadKeys(ctx context.Context) {
	deadKeys, err := p.redis.SMembers(ctx, "nvidia:keys:dead").Result()
	if err != nil {
		log.Printf("Prober: failed to get dead keys: %v", err)
		return
	}

	for _, key := range deadKeys {
		// Try to list models as a lightweight probe
		req, _ := http.NewRequestWithContext(ctx, "GET", "https://integrate.api.nvidia.com/v1/models", nil)
		req.Header.Set("Authorization", "Bearer "+key)

		resp, err := p.client.Do(req)
		if err != nil {
			continue // still broken
		}
		resp.Body.Close()

		if resp.StatusCode == 200 {
			// Resurrect the key
			log.Printf("Prober: Resurrecting key %s", key[:10]+"...")
			p.redis.SRem(ctx, "nvidia:keys:dead", key)
			// Set cooling to 0
			p.scheduler.MarkCooling(ctx, key, 0)
		} else if resp.StatusCode == 401 || resp.StatusCode == 403 {
			// Definitively dead, keep it there or remove it from database entirely
			// In a full implementation, we'd mark it 'Dead' in PostgreSQL here
		}
	}
}
