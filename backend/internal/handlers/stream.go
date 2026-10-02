package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func (d *Deps) Stream(c *gin.Context) {
	oid, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"})
		return
	}

	fetchCtx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	var poll struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	err = d.DB.Collection("polls").FindOne(fetchCtx, bson.M{"_id": oid}).Decode(&poll)
	cancel()
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
			return
		}
		respondDBErr(c, err)
		return
	}

	pollID := oid.Hex()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	viewersKey := "poll:" + pollID + ":viewers"
	incrCtx, incrCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	d.RDB.Incr(incrCtx, viewersKey)
	incrCancel()

	// By the time a client disconnects and this cleanup runs, the request
	// context is already Done() — so it intentionally uses its own fresh
	// background context rather than the (dead) request one.
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cleanupCancel()
		d.RDB.Decr(cleanupCtx, viewersKey)
	}()

	ch, leave := d.Hub.Join(pollID)
	defer leave()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming unsupported"})
		return
	}

	snapshotCtx, snapshotCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	snapshot, err := d.snapshotPayload(snapshotCtx, pollID)
	snapshotCancel()
	if err == nil {
		fmt.Fprintf(c.Writer, "data: %s\n\n", snapshot)
		flusher.Flush()
	}

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	reqCtx := c.Request.Context()

	for {
		select {
		case <-reqCtx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			fmt.Fprintf(c.Writer, "data: %s\n\n", msg)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprint(c.Writer, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

func (d *Deps) snapshotPayload(ctx context.Context, pollID string) (string, error) {
	counts, err := d.RDB.HGetAll(ctx, "poll:"+pollID+":counts").Result()
	if err != nil {
		return "", err
	}
	weighted, err := d.RDB.HGetAll(ctx, "poll:"+pollID+":weighted").Result()
	if err != nil {
		return "", err
	}

	total := 0
	countParts := ""
	first := true
	for k, v := range counts {
		n, _ := strconv.Atoi(v)
		total += n
		if !first {
			countParts += ","
		}
		countParts += fmt.Sprintf("%q:%d", k, n)
		first = false
	}

	weightedParts := ""
	first = true
	for k, v := range weighted {
		n, _ := strconv.Atoi(v)
		if !first {
			weightedParts += ","
		}
		weightedParts += fmt.Sprintf("%q:%d", k, n)
		first = false
	}

	return fmt.Sprintf(`{"type":"snapshot","counts":{%s},"weighted":{%s},"total":%d}`, countParts, weightedParts, total), nil
}
