package db

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func Connect(uri string) (*mongo.Client, *mongo.Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, nil, err
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, nil, err
	}

	database := client.Database("pulse")

	if err := ensureIndexes(ctx, database); err != nil {
		return nil, nil, err
	}

	return client, database, nil
}

func ensureIndexes(ctx context.Context, database *mongo.Database) error {
	_, err := database.Collection("users").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}

	_, err = database.Collection("polls").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "joinCode", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}

	_, err = database.Collection("votelogs").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "pollId", Value: 1}, {Key: "voterHash", Value: 1}},
	})
	if err != nil {
		return err
	}

	_, err = database.Collection("polls").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "closed", Value: 1}, {Key: "expiresAt", Value: 1}},
	})
	return err
}
