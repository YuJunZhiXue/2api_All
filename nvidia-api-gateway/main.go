package main

import (
	"context"
	"log"
	"os"

	"nvidia-api-gateway/pkg/gateway"
	"nvidia-api-gateway/pkg/scheduler"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func main() {
	_ = godotenv.Load()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})

	sched := scheduler.NewScheduler(redisClient)
	gw := gateway.NewGateway(sched)

	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	// Add dummy keys for testing
	// In production, these should be loaded from the database and decrypted
	_ = sched.AddKey(context.Background(), "sk-nv-dummy-key-1", 10.0)
	_ = sched.AddKey(context.Background(), "sk-nv-dummy-key-2", 5.0)

	app.Post("/v1/chat/completions", gw.HandleChatCompletions)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Nvidia API Gateway on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
