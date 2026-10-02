package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Health pings Mongo and Redis independently with short timeouts so an
// orchestrator can tell "the process is up" apart from "its dependencies
// are reachable." It never panics even if both are down.
func (d *Deps) Health(c *gin.Context) {
	mongoStatus := "up"
	mongoCtx, mongoCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	if err := d.DB.Client().Ping(mongoCtx, nil); err != nil {
		mongoStatus = "down"
	}
	mongoCancel()

	redisStatus := "up"
	redisCtx, redisCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	if err := d.RDB.Ping(redisCtx).Err(); err != nil {
		redisStatus = "down"
	}
	redisCancel()

	if mongoStatus == "down" || redisStatus == "down" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "error",
			"mongo":  mongoStatus,
			"redis":  redisStatus,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"mongo":  mongoStatus,
		"redis":  redisStatus,
	})
}
