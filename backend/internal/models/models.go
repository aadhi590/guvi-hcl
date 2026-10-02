package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"passwordHash" json:"-"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
}

type Option struct {
	ID   string `bson:"id" json:"id"`
	Text string `bson:"text" json:"text"`
}

type Poll struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Question        string             `bson:"question" json:"question"`
	Options         []Option           `bson:"options" json:"options"`
	OwnerID         primitive.ObjectID `bson:"ownerId" json:"ownerId"`
	JoinCode        string             `bson:"joinCode" json:"joinCode"`
	ResultsHidden   bool               `bson:"resultsHidden" json:"resultsHidden"`
	Closed          bool               `bson:"closed" json:"closed"`
	ExpiresAt       *time.Time         `bson:"expiresAt,omitempty" json:"expiresAt,omitempty"`
	QuizMode        bool               `bson:"quizMode" json:"quizMode"`
	CorrectOptionID string             `bson:"correctOptionId,omitempty" json:"correctOptionId,omitempty"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
}

// VoteLog is the append-only Mongo audit trail. It is never updated after
// insert; Redis counts/weights can always be rebuilt from this collection.
type VoteLog struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PollID     primitive.ObjectID `bson:"pollId" json:"pollId"`
	OptionID   string             `bson:"optionId" json:"optionId"`
	VoterHash  string             `bson:"voterHash" json:"voterHash"`
	Confidence int                `bson:"confidence" json:"confidence"`
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}
