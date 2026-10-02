package handlers

import (
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"pulse/internal/realtime"
)

type Deps struct {
	DB              *mongo.Database
	RDB             *redis.Client
	Hub             *realtime.Hub
	JWTSecret       string
	FrontendOrigins []string
}
