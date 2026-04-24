package scheduler

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	// LuaAcquireKey tries to find an available API key.
	// Keys: [active_keys_zset, cooling_keys_set, dead_keys_set]
	// Args: [max_concurrency, lock_ttl, now_timestamp]
	// Returns: key string if success, "" if none available
	LuaAcquireKey = redis.NewScript(`
local active_keys = KEYS[1]
local cooling_keys = KEYS[2]
local dead_keys = KEYS[3]

local max_concurrency = tonumber(ARGV[1])
local lock_ttl = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Get all keys ordered by score (weight) descending
local keys = redis.call("ZREVRANGE", active_keys, 0, -1)

for _, key in ipairs(keys) do
	-- Check if it's dead
	if redis.call("SISMEMBER", dead_keys, key) == 0 then
		-- Check if it's cooling
		local cool_until = redis.call("HGET", "key_cooling", key)
		if not cool_until or tonumber(cool_until) < now then
			-- Check concurrency
			local c_key = "concurrency:" .. key
			local current = redis.call("GET", c_key)
			if not current then
				current = 0
			else
				current = tonumber(current)
			end
			
			if current < max_concurrency then
				-- Increment concurrency
				redis.call("INCR", c_key)
				redis.call("EXPIRE", c_key, lock_ttl)
				return key
			end
		end
	end
end

return ""
`)

	// LuaReleaseKey decrements concurrency
	LuaReleaseKey = redis.NewScript(`
local c_key = "concurrency:" .. KEYS[1]
local current = tonumber(redis.call("GET", c_key) or "0")
if current > 0 then
	redis.call("DECR", c_key)
end
return 1
`)
)

type Scheduler struct {
	client *redis.Client
}

func NewScheduler(client *redis.Client) *Scheduler {
	return &Scheduler{
		client: client,
	}
}

// AddKey adds a key to the active pool with a given weight
func (s *Scheduler) AddKey(ctx context.Context, key string, weight float64) error {
	return s.client.ZAdd(ctx, "nvidia:keys:active", redis.Z{Score: weight, Member: key}).Err()
}

// AcquireKey gets an available key
func (s *Scheduler) AcquireKey(ctx context.Context, maxConcurrency int) (string, error) {
	now := time.Now().Unix()
	res, err := LuaAcquireKey.Run(ctx, s.client,
		[]string{"nvidia:keys:active", "nvidia:keys:cooling", "nvidia:keys:dead"},
		maxConcurrency, 60, now).Result()

	if err == redis.Nil {
		return "", nil
	}
	if err != nil {
		return "", err
	}

	str, ok := res.(string)
	if !ok || str == "" {
		return "", nil
	}
	return str, nil
}

// ReleaseKey releases a key's concurrency
func (s *Scheduler) ReleaseKey(ctx context.Context, key string) error {
	return LuaReleaseKey.Run(ctx, s.client, []string{key}).Err()
}

// MarkCooling marks a key as cooling for a specific duration
func (s *Scheduler) MarkCooling(ctx context.Context, key string, duration time.Duration) error {
	coolUntil := time.Now().Add(duration).Unix()
	return s.client.HSet(ctx, "key_cooling", key, coolUntil).Err()
}

// MarkDead marks a key as permanently dead
func (s *Scheduler) MarkDead(ctx context.Context, key string) error {
	return s.client.SAdd(ctx, "nvidia:keys:dead", key).Err()
}
