package middleware

import (
	"context"
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

const (
	voteRateLimitWindow    = 2 * time.Second
	voteRateLimitThreshold = 5

	authRateLimitWindow    = 60 * time.Second
	authRateLimitThreshold = 10
)

// RateLimit is the IP-based limiter used for voting (and reused as-is for
// the lightly-limited reaction endpoint, per the same rl:{ip} pattern).
func RateLimit(rdb *redis.Client) gin.HandlerFunc {
	return rateLimit(rdb, "rl:", voteRateLimitWindow, voteRateLimitThreshold)
}

// AuthRateLimit is a stricter, separately-keyed limiter for signup/login to
// blunt brute-forcing, independent of the voting rl:{ip} bucket.
func AuthRateLimit(rdb *redis.Client) gin.HandlerFunc {
	return rateLimit(rdb, "rl:auth:", authRateLimitWindow, authRateLimitThreshold)
}

func rateLimit(rdb *redis.Client, keyPrefix string, window time.Duration, threshold int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		key := keyPrefix + c.ClientIP()

		count, err := rdb.Incr(ctx, key).Result()
		if err != nil {
			if isTimeoutErr(err) {
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "service temporarily unavailable"})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "rate limiter unavailable"})
			return
		}

		if count == 1 {
			rdb.Expire(ctx, key, window)
		}

		if count > threshold {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, slow down"})
			return
		}

		c.Next()
	}
}

func isTimeoutErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	return false
}
