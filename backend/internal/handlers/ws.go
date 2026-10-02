package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	wsWriteTimeout = 10 * time.Second
	wsPongTimeout  = 60 * time.Second
	wsPingInterval = 20 * time.Second
)

func (d *Deps) wsUpgrader() *websocket.Upgrader {
	return &websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				// non-browser clients (curl, test scripts) send no Origin header
				return true
			}
			for _, allowed := range d.FrontendOrigins {
				if origin == allowed {
					return true
				}
			}
			return false
		},
	}
}

// WebSocketStream is a second live-update transport over the exact same
// Redis-driven pipeline as Stream (SSE): same hub.Join subscription, same
// snapshot-on-connect, same pub/sub payloads — just pushed as WS text
// frames instead of "data:" lines, for clients that want a real websocket
// rather than an EventSource.
func (d *Deps) WebSocketStream(c *gin.Context) {
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

	conn, err := d.wsUpgrader().Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		// Upgrade already wrote an HTTP error response on failure.
		return
	}

	pollID := oid.Hex()
	viewersKey := "poll:" + pollID + ":viewers"

	incrCtx, incrCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	d.RDB.Incr(incrCtx, viewersKey)
	incrCancel()

	ch, leave := d.Hub.Join(pollID)

	done := make(chan struct{})
	_ = conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
	})

	// Read pump: the client never sends meaningful messages over this
	// connection, but a goroutine must keep reading to process control
	// frames (pong/close) and to detect disconnects promptly.
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	defer func() {
		leave()
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 2*time.Second)
		d.RDB.Decr(cleanupCtx, viewersKey)
		cleanupCancel()
		_ = conn.Close()
	}()

	snapshotCtx, snapshotCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	snapshot, err := d.snapshotPayload(snapshotCtx, pollID)
	snapshotCancel()
	if err == nil {
		_ = conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
		if writeErr := conn.WriteMessage(websocket.TextMessage, []byte(snapshot)); writeErr != nil {
			return
		}
	}

	ticker := time.NewTicker(wsPingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			// The read pump's done channel is the right disconnect signal
			// here, not c.Request.Context(): after Upgrade() hijacks the
			// connection, Gin/net-http can cancel the request context
			// almost immediately (it's scoped to the HTTP handler, not the
			// raw hijacked conn), so watching it here would tear the
			// connection down right after the snapshot.
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			_ = conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
			if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
				return
			}
		case <-ticker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
