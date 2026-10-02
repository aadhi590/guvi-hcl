package handlers

import (
	"context"
	"errors"
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
)

func isTimeoutErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	if mongo.IsTimeout(err) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	return false
}

// respondDBErr maps a Mongo/Redis driver error to an HTTP response without
// ever leaking the raw driver error to the client: a timeout becomes a 503
// so callers know it's worth retrying, anything else becomes a generic 500.
func respondDBErr(c *gin.Context, err error) {
	if isTimeoutErr(err) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service temporarily unavailable"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
}
