package validation

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func ValidateEmail(email string) error {
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email address")
	}
	return nil
}

func ValidatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	return nil
}

func ValidateQuestion(question string) (string, error) {
	q := strings.TrimSpace(question)
	if len(q) < 1 || len(q) > 200 {
		return "", errors.New("question must be 1-200 characters")
	}
	return q, nil
}

func ValidateOptions(options []string) ([]string, error) {
	if len(options) < 2 || len(options) > 10 {
		return nil, errors.New("poll must have between 2 and 10 options")
	}

	trimmed := make([]string, 0, len(options))
	seen := make(map[string]struct{}, len(options))

	for _, opt := range options {
		t := strings.TrimSpace(opt)
		if len(t) < 1 || len(t) > 80 {
			return nil, errors.New("each option must be 1-80 characters")
		}
		key := strings.ToLower(t)
		if _, exists := seen[key]; exists {
			return nil, errors.New("duplicate options are not allowed")
		}
		seen[key] = struct{}{}
		trimmed = append(trimmed, t)
	}

	return trimmed, nil
}

// ValidateExpiresAt parses an optional ISO 8601 timestamp. An empty string
// means "no expiry" and returns a nil time with no error. A non-empty value
// must parse as RFC3339 (ISO 8601) and must be in the future.
func ValidateExpiresAt(raw string) (*time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil, errors.New("expiresAt must be a valid ISO 8601 timestamp")
	}
	if !t.After(time.Now().UTC()) {
		return nil, errors.New("expiresAt must be in the future")
	}
	return &t, nil
}

func NormalizeJoinCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func ValidateVoterToken(token string) error {
	if strings.TrimSpace(token) == "" {
		return errors.New("voterToken is required")
	}
	return nil
}

// allowedReactionEmojis is the fixed set of live reactions a viewer may
// send. Anything outside this list is rejected rather than broadcast.
var allowedReactionEmojis = map[string]struct{}{
	"🔥":  {},
	"👏":  {},
	"🤯":  {},
	"😂":  {},
	"❤️": {},
}

func ValidateEmoji(emoji string) error {
	if _, ok := allowedReactionEmojis[emoji]; !ok {
		return errors.New("unsupported reaction")
	}
	return nil
}

// ValidateNickname enforces length and, since the nickname is embedded into
// a hand-built JSON/Lua string on the vote path, rejects characters that
// could break that encoding. This is deliberately not a profanity filter.
func ValidateNickname(nickname string) (string, error) {
	n := strings.TrimSpace(nickname)
	if len(n) < 1 || len(n) > 30 {
		return "", errors.New("nickname must be 1-30 characters")
	}
	for _, r := range n {
		if r == '"' || r == '\\' || r < 0x20 {
			return "", errors.New("nickname contains invalid characters")
		}
	}
	return n, nil
}

// ValidateConfidence returns the default confidence (3) when the field was
// omitted (nil pointer), otherwise validates the explicit value is 1-5.
func ValidateConfidence(confidence *int) (int, error) {
	if confidence == nil {
		return 3, nil
	}
	if *confidence < 1 || *confidence > 5 {
		return 0, errors.New("confidence must be between 1 and 5")
	}
	return *confidence, nil
}
