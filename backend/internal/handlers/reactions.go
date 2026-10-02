package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"pulse/internal/validation"
)

type reactRequest struct {
	Emoji string `json:"emoji"`
}

// React publishes a live emoji reaction directly over Redis pub/sub.
// Reactions are intentionally ephemeral: they are never written to Mongo or
// to any Redis storage key (no hash, no set, no log) — only broadcast to
// whoever is currently connected — so there is nothing to persist,
// rate-limit-store, or clean up for them.
func (d *Deps) React(c *gin.Context) {
	oid, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"})
		return
	}

	var req reactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := validation.ValidateEmoji(req.Emoji); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll struct {
		Closed bool `bson:"closed"`
	}
	if err := d.DB.Collection("polls").FindOne(ctx, bson.M{"_id": oid}).Decode(&poll); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
			return
		}
		respondDBErr(c, err)
		return
	}
	if poll.Closed {
		c.JSON(http.StatusConflict, gin.H{"error": "this poll is closed"})
		return
	}

	payload := fmt.Sprintf(`{"type":"reaction","emoji":%q}`, req.Emoji)
	d.RDB.Publish(ctx, "poll:"+oid.Hex()+":reactions", payload)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
