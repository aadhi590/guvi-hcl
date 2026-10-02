package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	MongoURI       string
	RedisURL       string
	JWTSecret      string
	FrontendOrigins []string
}

func Load() *Config {
	if os.Getenv("ENV") != "production" {
		_ = godotenv.Load()
	}

	rawOrigins := getEnv("FRONTEND_ORIGIN", "http://localhost:5173")
	var origins []string
	for _, orig := range strings.Split(rawOrigins, ",") {
		trimmed := strings.TrimSpace(orig)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	if len(origins) == 0 {
		origins = []string{"http://localhost:5173"}
	}

	cfg := &Config{
		Port:            getEnv("PORT", "8080"),
		MongoURI:        os.Getenv("MONGO_URI"),
		RedisURL:        os.Getenv("REDIS_URL"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		FrontendOrigins: origins,
	}

	if cfg.JWTSecret == "" {
		log.Panic("JWT_SECRET is required")
	}
	if cfg.MongoURI == "" {
		log.Panic("MONGO_URI is required")
	}
	if cfg.RedisURL == "" {
		log.Panic("REDIS_URL is required")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
