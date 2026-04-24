package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/redis/go-redis/v9"
)

type SemanticCache struct {
	client *redis.Client
}

func NewSemanticCache(client *redis.Client) *SemanticCache {
	return &SemanticCache{
		client: client,
	}
}

func (c *SemanticCache) generateKey(model, prompt string) string {
	hash := sha256.Sum256([]byte(model + ":" + prompt))
	return "semantic_cache:" + hex.EncodeToString(hash[:])
}

// Get returns the cached response if available.
func (c *SemanticCache) Get(ctx context.Context, model, prompt string) (string, error) {
	key := c.generateKey(model, prompt)
	res, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	return res, err
}

// Set saves the response to cache with a TTL (e.g., 24 hours).
func (c *SemanticCache) Set(ctx context.Context, model, prompt, response string, ttl time.Duration) error {
	key := c.generateKey(model, prompt)
	return c.client.Set(ctx, key, response, ttl).Err()
}
