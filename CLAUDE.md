# Pulse — live polling for classrooms
Stack: React (Vite, TS, Tailwind) /frontend | Go Gin /backend | MongoDB Atlas | Upstash Redis
Flow: signup/login → create poll → share link/QR/join code → audience votes → live results

## Architecture
- Redis = live source of truth: counts hash poll:{id}:counts, voter set poll:{id}:voters, closed flag poll:{id}:closed, viewers poll:{id}:viewers, momentum buckets poll:{id}:m:{unixSec} (TTL 10m), rate limit rl:{ip}
- Vote = single Lua script: check closed → SADD voter (dedupe) → HINCRBY → PUBLISH poll:{id} JSON
- Each backend instance PSUBSCRIBE poll:* → fans out to SSE clients (hub). Heartbeat 20s, no buffering.
- Reactions: pub/sub only, never stored.
- Mongo: users (bcrypt), polls, votes audit (async insert). Rebuild Redis counts from Mongo if missing.
- Auth: JWT (Authorization header). Create/close/reveal = owner only. Voting anonymous: voterToken (uuid, localStorage) + IP hash.
- Poll fields: question(≤200), options 2–10 unique non-empty(≤80), joinCode(6 char), resultsHidden(bool), expiresAt(optional), closed.
- Validate everything server-side.

## Rules
- Backend layout: main.go, internal/{config,db,models,handlers,middleware,realtime}
- Config via env: PORT, MONGO_URI, REDIS_URL, JWT_SECRET, FRONTEND_ORIGIN
- Keep code concise. No comments unless non-obvious. No explanations in replies.
