package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"pulse/internal/models"
	"pulse/internal/validation"
)

const joinCodeCharset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const joinCodeLength = 6

// voteScript is the single atomic Lua operation for casting a vote:
// closed check -> dedupe SADD -> HINCRBY counts -> HINCRBY weighted
// (confidence-weighted voting) -> momentum INCR -> optional quiz-mode ZADD
// onto the leaderboard -> PUBLISH update (+ PUBLISH leaderboard when quiz
// scoring applied). Keeping all of this in one script means the dedupe
// check, the count/weight increments, and the leaderboard write can never
// race against a concurrent duplicate vote.
//
// KEYS[1] = poll:{id}:closed
// KEYS[2] = poll:{id}:voters
// KEYS[3] = poll:{id}:counts
// KEYS[4] = poll:{id}:m:{currentUnixSecond}
// KEYS[5] = poll:{id}:leaderboard
// KEYS[6] = poll:{id}:weighted
// ARGV[1] = voterHash
// ARGV[2] = optionId
// ARGV[3] = pollId
// ARGV[4] = confidence (1-5)
// ARGV[5] = "1" if this is a correct quiz-mode answer, else "0"
// ARGV[6] = quiz score (only meaningful when ARGV[5] == "1")
// ARGV[7] = nickname (only meaningful when ARGV[5] == "1")
const voteScript = `
local closed = redis.call('EXISTS', KEYS[1])
if closed == 1 then
  return 'closed'
end
local added = redis.call('SADD', KEYS[2], ARGV[1])
if added == 0 then
  return 'duplicate'
end
redis.call('HINCRBY', KEYS[3], ARGV[2], 1)
redis.call('HINCRBY', KEYS[6], ARGV[2], tonumber(ARGV[4]))
redis.call('INCR', KEYS[4])
redis.call('EXPIRE', KEYS[4], 600)
if ARGV[5] == '1' then
  redis.call('ZADD', KEYS[5], tonumber(ARGV[6]), ARGV[7])
end
local counts = redis.call('HGETALL', KEYS[3])
local weighted = redis.call('HGETALL', KEYS[6])
local parts = {}
local total = 0
for i = 1, #counts, 2 do
  table.insert(parts, '"' .. counts[i] .. '":' .. counts[i + 1])
  total = total + tonumber(counts[i + 1])
end
local wparts = {}
for i = 1, #weighted, 2 do
  table.insert(wparts, '"' .. weighted[i] .. '":' .. weighted[i + 1])
end
local payload = '{"type":"update","counts":{' .. table.concat(parts, ',') .. '},"weighted":{' .. table.concat(wparts, ',') .. '},"total":' .. total .. '}'
redis.call('PUBLISH', 'poll:' .. ARGV[3], payload)
if ARGV[5] == '1' then
  local lb = redis.call('ZREVRANGE', KEYS[5], 0, 9, 'WITHSCORES')
  local lparts = {}
  for i = 1, #lb, 2 do
    table.insert(lparts, '{"nickname":"' .. lb[i] .. '","score":' .. lb[i + 1] .. '}')
  end
  local lpayload = '{"type":"leaderboard","top":[' .. table.concat(lparts, ',') .. ']}'
  redis.call('PUBLISH', 'poll:' .. ARGV[3], lpayload)
end
return 'ok'
`

type createPollRequest struct {
	Question        string   `json:"question"`
	Options         []string `json:"options"`
	ExpiresAt       string   `json:"expiresAt"`
	QuizMode        bool     `json:"quizMode"`
	CorrectOptionID string   `json:"correctOptionId"`
}

type voteRequest struct {
	OptionID   string `json:"optionId"`
	VoterToken string `json:"voterToken"`
	Nickname   string `json:"nickname"`
	Confidence *int   `json:"confidence"`
}

func (d *Deps) CreatePoll(c *gin.Context) {
	userID := c.GetString("userId")
	ownerID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
		return
	}

	var req createPollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	question, err := validation.ValidateQuestion(req.Question)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	optionTexts, err := validation.ValidateOptions(req.Options)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	opts := make([]models.Option, len(optionTexts))
	for i, text := range optionTexts {
		opts[i] = models.Option{ID: fmt.Sprintf("o%d", i+1), Text: text}
	}

	expiresAt, err := validation.ValidateExpiresAt(req.ExpiresAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.QuizMode {
		valid := false
		for _, opt := range opts {
			if opt.ID == req.CorrectOptionID {
				valid = true
				break
			}
		}
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "correctOptionId must be a valid option id"})
			return
		}
	} else if req.CorrectOptionID != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "correctOptionId is only valid when quizMode is true"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	poll := models.Poll{
		Question:        question,
		Options:         opts,
		OwnerID:         ownerID,
		ResultsHidden:   false,
		Closed:          false,
		ExpiresAt:       expiresAt,
		QuizMode:        req.QuizMode,
		CorrectOptionID: req.CorrectOptionID,
		CreatedAt:       time.Now().UTC(),
	}

	const maxAttempts = 10
	for attempt := 0; attempt < maxAttempts; attempt++ {
		code, err := generateJoinCode()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
		poll.JoinCode = code

		res, err := d.DB.Collection("polls").InsertOne(ctx, poll)
		if err == nil {
			poll.ID = res.InsertedID.(primitive.ObjectID)
			resp := gin.H{
				"id":       poll.ID.Hex(),
				"question": poll.Question,
				"options":  poll.Options,
				"joinCode": poll.JoinCode,
				"path":     "/poll/" + poll.ID.Hex(),
				"closed":   poll.Closed,
				"quizMode": poll.QuizMode,
			}
			if poll.QuizMode {
				resp["correctOptionId"] = poll.CorrectOptionID
			}
			c.JSON(http.StatusCreated, resp)
			return
		}
		if mongo.IsDuplicateKeyError(err) {
			continue
		}
		respondDBErr(c, err)
		return
	}

	c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate a unique join code, try again"})
}

func (d *Deps) GetPoll(c *gin.Context) {
	oid, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	if err := d.DB.Collection("polls").FindOne(ctx, bson.M{"_id": oid}).Decode(&poll); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
			return
		}
		respondDBErr(c, err)
		return
	}

	data, err := d.getOrRebuildVoteData(ctx, poll)
	if err != nil {
		respondDBErr(c, err)
		return
	}

	requesterID := c.GetString("userId")
	isOwner := requesterID != "" && requesterID == poll.OwnerID.Hex()

	resp := gin.H{
		"id":            poll.ID.Hex(),
		"question":      poll.Question,
		"options":       poll.Options,
		"joinCode":      poll.JoinCode,
		"resultsHidden": poll.ResultsHidden,
		"closed":        poll.Closed,
		"expiresAt":     poll.ExpiresAt,
		"createdAt":     poll.CreatedAt,
		"quizMode":      poll.QuizMode,
	}

	// The correct answer is only ever shown to the poll's owner, never to
	// voters, so it can't be read off the wire before/while voting.
	if poll.QuizMode && isOwner {
		resp["correctOptionId"] = poll.CorrectOptionID
	}

	if !poll.ResultsHidden || isOwner {
		weightedPercent := make(map[string]float64, len(poll.Options))
		for _, opt := range poll.Options {
			if data.TotalWeighted > 0 {
				pct := float64(data.Weighted[opt.ID]) / float64(data.TotalWeighted) * 100
				weightedPercent[opt.ID] = math.Round(pct*100) / 100
			} else {
				weightedPercent[opt.ID] = 0
			}
		}
		resp["counts"] = data.Counts
		resp["weighted"] = data.Weighted
		resp["weightedPercent"] = weightedPercent
		resp["total"] = data.Total
	}

	c.JSON(http.StatusOK, resp)
}

func (d *Deps) JoinByCode(c *gin.Context) {
	code := validation.NormalizeJoinCode(c.Param("joinCode"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	err := d.DB.Collection("polls").FindOne(ctx, bson.M{"joinCode": code}).Decode(&poll)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "no poll found with that join code"})
			return
		}
		respondDBErr(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       poll.ID.Hex(),
		"question": poll.Question,
		"closed":   poll.Closed,
	})
}

func (d *Deps) Vote(c *gin.Context) {
	pollIDParam := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(pollIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"})
		return
	}

	var req voteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := validation.ValidateVoterToken(req.VoterToken); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.OptionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "optionId is required"})
		return
	}

	confidence, err := validation.ValidateConfidence(req.Confidence)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	if err := d.DB.Collection("polls").FindOne(ctx, bson.M{"_id": oid}).Decode(&poll); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
			return
		}
		respondDBErr(c, err)
		return
	}

	validOption := false
	for _, opt := range poll.Options {
		if opt.ID == req.OptionID {
			validOption = true
			break
		}
	}
	if !validOption {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid optionId for this poll"})
		return
	}

	if poll.Closed {
		c.JSON(http.StatusConflict, gin.H{"error": "this poll is closed"})
		return
	}
	now := time.Now().UTC()
	if poll.ExpiresAt != nil && poll.ExpiresAt.Before(now) {
		c.JSON(http.StatusConflict, gin.H{"error": "this poll is closed"})
		return
	}

	var nickname string
	isQuizCorrect := false
	score := 0
	if poll.QuizMode {
		nickname, err = validation.ValidateNickname(req.Nickname)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.OptionID == poll.CorrectOptionID {
			isQuizCorrect = true
			elapsedMs := now.Sub(poll.CreatedAt).Milliseconds()
			score = int(1000 - elapsedMs)
			if score < 0 {
				score = 0
			}
		}
	}

	clientIP := c.ClientIP()
	voterHash := sha256Hex(req.VoterToken + "|" + clientIP)

	pollID := oid.Hex()
	nowSec := now.Unix()

	keys := []string{
		"poll:" + pollID + ":closed",
		"poll:" + pollID + ":voters",
		"poll:" + pollID + ":counts",
		"poll:" + pollID + ":m:" + strconv.FormatInt(nowSec, 10),
		"poll:" + pollID + ":leaderboard",
		"poll:" + pollID + ":weighted",
	}

	quizFlag := "0"
	if isQuizCorrect {
		quizFlag = "1"
	}

	result, err := d.RDB.Eval(ctx, voteScript, keys,
		voterHash, req.OptionID, pollID, confidence, quizFlag, score, nickname,
	).Result()
	if err != nil {
		respondDBErr(c, err)
		return
	}

	status, _ := result.(string)
	switch status {
	case "ok":
		go d.insertVoteLog(oid, req.OptionID, voterHash, confidence)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	case "duplicate":
		c.JSON(http.StatusConflict, gin.H{"error": "you have already voted"})
	case "closed":
		c.JSON(http.StatusConflict, gin.H{"error": "this poll is closed"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "unexpected vote result"})
	}
}

func (d *Deps) insertVoteLog(pollID primitive.ObjectID, optionID, voterHash string, confidence int) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	entry := models.VoteLog{
		PollID:     pollID,
		OptionID:   optionID,
		VoterHash:  voterHash,
		Confidence: confidence,
		CreatedAt:  time.Now().UTC(),
	}
	_, _ = d.DB.Collection("votelogs").InsertOne(ctx, entry)
}

func (d *Deps) ClosePoll(c *gin.Context) {
	poll, ok := d.requireOwnedPoll(c)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err := d.DB.Collection("polls").UpdateOne(ctx, bson.M{"_id": poll.ID}, bson.M{"$set": bson.M{"closed": true}})
	if err != nil {
		respondDBErr(c, err)
		return
	}
	poll.Closed = true

	pollID := poll.ID.Hex()
	d.RDB.Set(ctx, "poll:"+pollID+":closed", "1", 0)
	d.RDB.Publish(ctx, "poll:"+pollID, `{"type":"closed"}`)

	c.JSON(http.StatusOK, gin.H{
		"id":            poll.ID.Hex(),
		"question":      poll.Question,
		"options":       poll.Options,
		"joinCode":      poll.JoinCode,
		"resultsHidden": poll.ResultsHidden,
		"closed":        poll.Closed,
	})
}

// DeletePoll permanently removes a poll: the owner-only guard mirrors
// ClosePoll/RevealPoll, but unlike closing (which just stops new votes)
// this erases the poll document, its vote audit trail, and every live
// Redis key for it, and tells any connected viewers immediately.
func (d *Deps) DeletePoll(c *gin.Context) {
	poll, ok := d.requireOwnedPoll(c)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	pollID := poll.ID.Hex()

	// Tell connected viewers before the data disappears under them.
	d.RDB.Publish(ctx, "poll:"+pollID, `{"type":"deleted"}`)

	if _, err := d.DB.Collection("polls").DeleteOne(ctx, bson.M{"_id": poll.ID}); err != nil {
		respondDBErr(c, err)
		return
	}

	// Best-effort: the poll document is already gone, so a failure here
	// just leaves orphaned audit rows rather than blocking the delete.
	_, _ = d.DB.Collection("votelogs").DeleteMany(ctx, bson.M{"pollId": poll.ID})

	d.RDB.Del(ctx,
		"poll:"+pollID+":counts",
		"poll:"+pollID+":voters",
		"poll:"+pollID+":closed",
		"poll:"+pollID+":viewers",
		"poll:"+pollID+":weighted",
		"poll:"+pollID+":leaderboard",
	)

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (d *Deps) RevealPoll(c *gin.Context) {
	poll, ok := d.requireOwnedPoll(c)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err := d.DB.Collection("polls").UpdateOne(ctx, bson.M{"_id": poll.ID}, bson.M{"$set": bson.M{"resultsHidden": false}})
	if err != nil {
		respondDBErr(c, err)
		return
	}
	poll.ResultsHidden = false

	pollID := poll.ID.Hex()
	d.RDB.Publish(ctx, "poll:"+pollID, `{"type":"revealed"}`)

	c.JSON(http.StatusOK, gin.H{
		"id":            poll.ID.Hex(),
		"question":      poll.Question,
		"options":       poll.Options,
		"joinCode":      poll.JoinCode,
		"resultsHidden": poll.ResultsHidden,
		"closed":        poll.Closed,
	})
}

func (d *Deps) MyPolls(c *gin.Context) {
	userID := c.GetString("userId")
	ownerID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := d.DB.Collection("polls").Find(ctx, bson.M{"ownerId": ownerID}, findOpts)
	if err != nil {
		respondDBErr(c, err)
		return
	}
	defer cursor.Close(ctx)

	var polls []models.Poll
	if err := cursor.All(ctx, &polls); err != nil {
		respondDBErr(c, err)
		return
	}

	resp := make([]gin.H, 0, len(polls))
	for _, poll := range polls {
		data, err := d.getOrRebuildVoteData(ctx, poll)
		total := 0
		if err == nil {
			total = data.Total
		}
		resp = append(resp, gin.H{
			"id":            poll.ID.Hex(),
			"question":      poll.Question,
			"options":       poll.Options,
			"joinCode":      poll.JoinCode,
			"resultsHidden": poll.ResultsHidden,
			"closed":        poll.Closed,
			"createdAt":     poll.CreatedAt,
			"quizMode":      poll.QuizMode,
			"total":         total,
		})
	}

	c.JSON(http.StatusOK, resp)
}

func (d *Deps) Momentum(c *gin.Context) {
	poll, ok := d.requireOwnedPoll(c)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	const window = 60
	now := time.Now().Unix()
	pollID := poll.ID.Hex()

	keys := make([]string, window)
	seconds := make([]int64, window)
	for i := 0; i < window; i++ {
		sec := now - int64(window-1-i)
		seconds[i] = sec
		keys[i] = "poll:" + pollID + ":m:" + strconv.FormatInt(sec, 10)
	}

	values, err := d.RDB.MGet(ctx, keys...).Result()
	if err != nil {
		respondDBErr(c, err)
		return
	}

	type point struct {
		Second int64 `json:"second"`
		Count  int   `json:"count"`
	}

	series := make([]point, window)
	for i, v := range values {
		count := 0
		if v != nil {
			if s, ok := v.(string); ok {
				if n, err := strconv.Atoi(s); err == nil {
					count = n
				}
			}
		}
		series[i] = point{Second: seconds[i], Count: count}
	}

	c.JSON(http.StatusOK, series)
}

func (d *Deps) requireOwnedPoll(c *gin.Context) (models.Poll, bool) {
	oid, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"})
		return models.Poll{}, false
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	if err := d.DB.Collection("polls").FindOne(ctx, bson.M{"_id": oid}).Decode(&poll); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
			return models.Poll{}, false
		}
		respondDBErr(c, err)
		return models.Poll{}, false
	}

	userID := c.GetString("userId")
	if poll.OwnerID.Hex() != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not own this poll"})
		return models.Poll{}, false
	}

	return poll, true
}

type voteData struct {
	Counts        map[string]int
	Weighted      map[string]int
	Total         int
	TotalWeighted int
}

func (d *Deps) getOrRebuildVoteData(ctx context.Context, poll models.Poll) (voteData, error) {
	pollID := poll.ID.Hex()
	countsKey := "poll:" + pollID + ":counts"
	weightedKey := "poll:" + pollID + ":weighted"

	rawCounts, err := d.RDB.HGetAll(ctx, countsKey).Result()
	if err != nil {
		return voteData{}, err
	}
	rawWeighted, err := d.RDB.HGetAll(ctx, weightedKey).Result()
	if err != nil {
		return voteData{}, err
	}

	if len(rawCounts) == 0 {
		rc, rw, err := d.rebuildVoteDataFromMongo(ctx, poll)
		if err != nil {
			return voteData{}, err
		}
		rawCounts = rc
		rawWeighted = rw
	}

	counts := make(map[string]int, len(poll.Options))
	weighted := make(map[string]int, len(poll.Options))
	for _, opt := range poll.Options {
		counts[opt.ID] = 0
		weighted[opt.ID] = 0
	}

	total := 0
	for k, v := range rawCounts {
		n, _ := strconv.Atoi(v)
		counts[k] = n
		total += n
	}

	totalWeighted := 0
	for k, v := range rawWeighted {
		n, _ := strconv.Atoi(v)
		weighted[k] = n
		totalWeighted += n
	}

	return voteData{Counts: counts, Weighted: weighted, Total: total, TotalWeighted: totalWeighted}, nil
}

func (d *Deps) rebuildVoteDataFromMongo(ctx context.Context, poll models.Poll) (map[string]string, map[string]string, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"pollId": poll.ID}}},
		{{Key: "$group", Value: bson.M{
			"_id":      "$optionId",
			"count":    bson.M{"$sum": 1},
			"weighted": bson.M{"$sum": "$confidence"},
		}}},
	}

	cursor, err := d.DB.Collection("votelogs").Aggregate(ctx, pipeline)
	if err != nil {
		return nil, nil, err
	}
	defer cursor.Close(ctx)

	type aggResult struct {
		ID       string `bson:"_id"`
		Count    int    `bson:"count"`
		Weighted int    `bson:"weighted"`
	}

	counts := make(map[string]string)
	weighted := make(map[string]string)
	for cursor.Next(ctx) {
		var r aggResult
		if err := cursor.Decode(&r); err != nil {
			return nil, nil, err
		}
		counts[r.ID] = strconv.Itoa(r.Count)
		weighted[r.ID] = strconv.Itoa(r.Weighted)
	}

	if len(counts) == 0 {
		return counts, weighted, nil
	}

	pollID := poll.ID.Hex()

	countFields := make(map[string]interface{}, len(counts))
	for k, v := range counts {
		countFields[k] = v
	}
	d.RDB.HSet(ctx, "poll:"+pollID+":counts", countFields)

	weightedFields := make(map[string]interface{}, len(weighted))
	for k, v := range weighted {
		weightedFields[k] = v
	}
	if len(weightedFields) > 0 {
		d.RDB.HSet(ctx, "poll:"+pollID+":weighted", weightedFields)
	}

	return counts, weighted, nil
}

func generateJoinCode() (string, error) {
	buf := make([]byte, joinCodeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	code := make([]byte, joinCodeLength)
	for i, b := range buf {
		code[i] = joinCodeCharset[int(b)%len(joinCodeCharset)]
	}
	return string(code), nil
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
