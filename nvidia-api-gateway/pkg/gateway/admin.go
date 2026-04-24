package gateway

import (
	"nvidia-api-gateway/pkg/db"
	"nvidia-api-gateway/pkg/models"
	"nvidia-api-gateway/pkg/utils"
	"os"

	"github.com/gofiber/fiber/v2"
)

// AddAPIKey handles adding a new Nvidia API key via the management dashboard.
func AddAPIKey(c *fiber.Ctx) error {
	type Request struct {
		Key    string  `json:"key"`
		Name   string  `json:"name"`
		Weight float64 `json:"weight"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	rootKey := os.Getenv("ENCRYPTION_KEY")
	if rootKey == "" || len(rootKey) != 32 {
		return c.Status(500).JSON(fiber.Map{"error": "Server missing valid 32-byte ENCRYPTION_KEY"})
	}

	encryptedKey, err := utils.Encrypt(req.Key, rootKey)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to encrypt key"})
	}

	apiKey := models.APIKey{
		Key:    encryptedKey,
		Name:   req.Name,
		Weight: req.Weight,
		Status: "Active",
	}

	if err := db.DB.Create(&apiKey).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save key to database"})
	}

	return c.JSON(fiber.Map{"message": "API Key added successfully", "id": apiKey.ID})
}

// GetAPIKeys returns a list of all API keys (without revealing the plaintext key).
func GetAPIKeys(c *fiber.Ctx) error {
	var keys []models.APIKey
	if err := db.DB.Select("id", "name", "weight", "status", "created_at").Find(&keys).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch keys"})
	}

	return c.JSON(keys)
}
