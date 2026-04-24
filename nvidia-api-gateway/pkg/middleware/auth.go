package middleware

import (
	"strings"

	"nvidia-api-gateway/pkg/db"
	"nvidia-api-gateway/pkg/models"

	"github.com/gofiber/fiber/v2"
)

// MasterAuthMiddleware verifies the Bearer token against the MasterKey database.
func MasterAuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing or invalid Authorization header",
			})
		}

		keyStr := strings.TrimPrefix(authHeader, "Bearer ")

		var masterKey models.MasterKey
		result := db.DB.Where("key = ? AND status = ?", keyStr, "Active").First(&masterKey)
		if result.Error != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or revoked Master Key",
			})
		}

		// Check Quota
		if masterKey.Quota != -1 && masterKey.UsedQuota >= masterKey.Quota {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error": "Quota exceeded",
			})
		}

		// Save the MasterKey to Context for rate limiting & token accounting
		c.Locals("masterKey", masterKey)

		return c.Next()
	}
}
