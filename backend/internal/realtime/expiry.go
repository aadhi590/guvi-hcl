package realtime

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// RunExpiryWatcher periodically sweeps Mongo for polls whose expiresAt has
// passed but are not yet marked closed, closes them in both Mongo and
// Redis, and publishes a "closed" event so connected viewers find out
// without anyone needing to hit the API.
func RunExpiryWatcher(ctx context.Context, database *mongo.Database, rdb *redis.Client, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sweepExpiredPolls(ctx, database, rdb)
		}
	}
}

func sweepExpiredPolls(ctx context.Context, database *mongo.Database, rdb *redis.Client) {
	findCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cursor, err := database.Collection("polls").Find(findCtx, bson.M{
		"closed":    false,
		"expiresAt": bson.M{"$lte": time.Now().UTC()},
	})
	if err != nil {
		log.Printf("realtime: expiry sweep find error: %v", err)
		return
	}
	defer cursor.Close(findCtx)

	var expired []struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	if err := cursor.All(findCtx, &expired); err != nil {
		log.Printf("realtime: expiry sweep decode error: %v", err)
		return
	}

	for _, p := range expired {
		closeExpiredPoll(ctx, database, rdb, p.ID)
	}
}

func closeExpiredPoll(ctx context.Context, database *mongo.Database, rdb *redis.Client, pollID primitive.ObjectID) {
	updateCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := database.Collection("polls").UpdateOne(updateCtx, bson.M{"_id": pollID}, bson.M{"$set": bson.M{"closed": true}})
	if err != nil {
		log.Printf("realtime: expiry sweep update error for %s: %v", pollID.Hex(), err)
		return
	}

	id := pollID.Hex()
	redisCtx, redisCancel := context.WithTimeout(ctx, 2*time.Second)
	defer redisCancel()

	rdb.Set(redisCtx, "poll:"+id+":closed", "1", 0)
	rdb.Publish(redisCtx, "poll:"+id, `{"type":"closed"}`)
}
