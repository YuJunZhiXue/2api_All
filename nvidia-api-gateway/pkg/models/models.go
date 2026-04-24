package models

import (
	"time"

	"gorm.io/gorm"
)

type APIKey struct {
	ID        uint           `gorm:"primaryKey"`
	Key       string         `gorm:"type:varchar(255);uniqueIndex;not null"` // Encrypted
	Name      string         `gorm:"type:varchar(100)"`
	Weight    float64        `gorm:"default:1.0"`
	Status    string         `gorm:"type:varchar(20);default:'Active'"` // Active, Dead
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type MasterKey struct {
	ID        uint           `gorm:"primaryKey"`
	Key       string         `gorm:"type:varchar(100);uniqueIndex;not null"`
	Name      string         `gorm:"type:varchar(100)"`
	RPM       int            `gorm:"default:60"`
	TPM       int            `gorm:"default:100000"`
	Quota     int64          `gorm:"default:-1"` // -1 for unlimited
	UsedQuota int64          `gorm:"default:0"`
	Status    string         `gorm:"type:varchar(20);default:'Active'"` // Active, Revoked
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
