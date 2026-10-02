package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type leaderboardEntry struct {
	Nickname string  `json:"nickname"`
	Score    float64 `json:"score"`
}

// Leaderboard returns the top 10 quiz-mode scorers. It reads straight from
// the Redis sorted set that the vote Lua script maintains, so this is a
// cheap O(log N) read with no Mongo round trip.
func (d *Deps) Leaderboard(c *gin.Context) {
	oid, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	results, err := d.RDB.ZRevRangeWithScores(ctx, "poll:"+oid.Hex()+":leaderboard", 0, 9).Result()
	if err != nil {
		respondDBErr(c, err)
		return
	}

	top := make([]leaderboardEntry, 0, len(results))
	for _, z := range results {
		nickname, _ := z.Member.(string)
		top = append(top, leaderboardEntry{Nickname: nickname, Score: z.Score})
	}

	c.JSON(http.StatusOK, top)
}
