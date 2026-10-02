package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"pulse/internal/config"
	"pulse/internal/db"
	"pulse/internal/handlers"
	"pulse/internal/middleware"
	"pulse/internal/realtime"
)

func main() {
	cfg := config.Load()

	mongoClient, mongoDB, err := db.Connect(cfg.MongoURI)
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}

	rdb, err := db.ConnectRedis(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis connect: %v", err)
	}

	hubCtx, hubCancel := context.WithCancel(context.Background())
	hub := realtime.NewHub(rdb)
	hub.Start(hubCtx)
	go realtime.RunExpiryWatcher(hubCtx, mongoDB, rdb, 30*time.Second)

	deps := &handlers.Deps{
		DB:              mongoDB,
		RDB:             rdb,
		Hub:             hub,
		JWTSecret:       cfg.JWTSecret,
		FrontendOrigins: cfg.FrontendOrigins,
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(requestLogger())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendOrigins,
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	registerRoutes(router, deps)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("pulse backend listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	hubCancel()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("server shutdown error: %v", err)
	}

	if err := mongoClient.Disconnect(shutdownCtx); err != nil {
		log.Printf("mongo disconnect error: %v", err)
	}

	if err := rdb.Close(); err != nil {
		log.Printf("redis close error: %v", err)
	}

	log.Println("shutdown complete")
}

func registerRoutes(router *gin.Engine, deps *handlers.Deps) {
	router.GET("/health", deps.Health)

	auth := router.Group("/auth")
	auth.Use(middleware.AuthRateLimit(deps.RDB))
	auth.POST("/signup", deps.Signup)
	auth.POST("/login", deps.Login)

	polls := router.Group("/polls")
	polls.GET("/join/:joinCode", deps.JoinByCode)
	polls.GET("/:id", middleware.OptionalAuth(deps.JWTSecret), deps.GetPoll)
	polls.GET("/:id/stream", deps.Stream)
	polls.GET("/:id/ws", deps.WebSocketStream)
	polls.GET("/:id/leaderboard", deps.Leaderboard)
	polls.POST("/:id/vote", middleware.RateLimit(deps.RDB), deps.Vote)
	polls.POST("/:id/react", middleware.RateLimit(deps.RDB), deps.React)

	protected := router.Group("/polls")
	protected.Use(middleware.RequireAuth(deps.JWTSecret))
	protected.POST("", deps.CreatePoll)
	protected.GET("/mine", deps.MyPolls)
	protected.POST("/:id/close", deps.ClosePoll)
	protected.DELETE("/:id", deps.DeletePoll)
	protected.PATCH("/:id/reveal", deps.RevealPoll)
	protected.GET("/:id/momentum", deps.Momentum)
}

func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		c.Next()
		log.Printf("method=%s path=%s status=%d latency=%s",
			c.Request.Method, path, c.Writer.Status(), time.Since(start))
	}
}
