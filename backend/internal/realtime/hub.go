package realtime

import (
	"context"
	"log"
	"strings"
	"sync"

	"github.com/redis/go-redis/v9"
)

type Hub struct {
	rdb  *redis.Client
	mu   sync.RWMutex
	subs map[string]map[chan string]struct{}
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{
		rdb:  rdb,
		subs: make(map[string]map[chan string]struct{}),
	}
}

// Start opens a single PSUBSCRIBE poll:* connection for the whole process
// and fans out every message to the registered per-poll subscriber channels.
// The poll:* pattern already covers both the main "poll:{id}" channel
// (votes, close, reveal, leaderboard) and the "poll:{id}:reactions"
// channel used for ephemeral reactions, so no second subscription is needed.
func (h *Hub) Start(ctx context.Context) {
	pubsub := h.rdb.PSubscribe(ctx, "poll:*")

	go func() {
		defer pubsub.Close()
		ch := pubsub.Channel()

		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				pollID := extractPollID(msg.Channel)
				if pollID == "" {
					continue
				}
				h.broadcast(pollID, msg.Payload)
			}
		}
	}()

	if _, err := pubsub.Receive(ctx); err != nil {
		log.Printf("realtime: psubscribe receive error: %v", err)
	}
}

// extractPollID isolates the id segment from a pub/sub channel name, which
// is either "poll:{id}" or "poll:{id}:reactions" — both fan out to the same
// per-poll subscriber channel, with the payload's own "type" field telling
// the client (and SSE handler, which passes messages through untouched)
// what kind of event it is.
func extractPollID(channel string) string {
	rest := strings.TrimPrefix(channel, "poll:")
	if rest == channel {
		return ""
	}
	if idx := strings.Index(rest, ":"); idx >= 0 {
		return rest[:idx]
	}
	return rest
}

func (h *Hub) broadcast(pollID, payload string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for ch := range h.subs[pollID] {
		select {
		case ch <- payload:
		default:
			// slow/stuck subscriber, drop the message rather than block the hub
		}
	}
}

// Join registers a new subscriber channel for pollID and returns it along
// with a leave function that must be called to unregister on disconnect.
func (h *Hub) Join(pollID string) (chan string, func()) {
	ch := make(chan string, 16)

	h.mu.Lock()
	if h.subs[pollID] == nil {
		h.subs[pollID] = make(map[chan string]struct{})
	}
	h.subs[pollID][ch] = struct{}{}
	h.mu.Unlock()

	leave := func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if set, ok := h.subs[pollID]; ok {
			delete(set, ch)
			if len(set) == 0 {
				delete(h.subs, pollID)
			}
		}
		close(ch)
	}

	return ch, leave
}
