# Pulse — Live Polling Platform for Classrooms and Live Sessions

Pulse is a high-performance, real-time live polling and audience engagement platform engineered for classrooms, meetups, and live presentations. It enables hosts to launch interactive polls, gather anonymous speed-scored responses or confidence-weighted votes, stream real-time results instantly without page refreshes, and visualize live audience momentum.

<!-- Replace the placeholder below with a real screenshot of the Pulse landing page or host dashboard prior to final submission -->
![Pulse Landing Page Banner](docs/screenshot-landing.png)

---

## Deployment & Live Links

- **Live Demo Application**: [https://pulse-poll.vercel.app](https://pulse-poll.vercel.app) *(Update with your production Vercel URL)*
- **Backend API Service**: [https://pulse-backend-production.up.railway.app](https://pulse-backend-production.up.railway.app) *(Update with your Railway service URL)*
- **GitHub Repository**: [https://github.com/aadhi590/guvi-hcl](https://github.com/aadhi590/guvi-hcl)

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite | Modern component lifecycle, strict type checking, sub-second HMR, and lean production bundles. |
| **Styling** | Tailwind CSS v4 | Utility-first, zero-runtime CSS with modern color spaces and custom glassmorphism design tokens. |
| **Backend Runtime** | Go 1.26 (Gin Web Framework) | High-concurrency, low-latency compiled backend capable of servicing thousands of simultaneous connections with minimal memory footprint. |
| **Realtime Engine** | Redis (Upstash Serverless Redis) | In-memory atomic data structures, high-throughput pub/sub broadcast channel, and Lua scripting engine. |
| **Durable Database** | MongoDB Atlas | Document storage for user profiles, poll metadata, and audit log entries. |
| **Deployment** | Vercel (Frontend) & Railway (Backend) | Edge CDN delivery for client assets and containerized continuous deployment for the Go API. |

---

## System Architecture

Pulse splits state responsibilities into two distinct layers:

```
                  ┌──────────────────────────────────────┐
                  │          React Client (SPA)          │
                  └──────────────┬───────────────────────┘
                                 │
                  HTTP / REST    │  SSE / WebSocket
                 (Votes/Actions) │ (Live Updates & Hub)
                                 ▼
                  ┌──────────────────────────────────────┐
                  │         Go Gin Backend Node          │
                  └──────────────┬───────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│     Redis (Live Engine)      │              │ MongoDB Atlas (Durable Store)│
├──────────────────────────────┤              ├──────────────────────────────┤
│ • poll:{id}:counts (Hash)    │              │ • users collection (bcrypt)  │
│ • poll:{id}:voters (Set)     │              │ • polls collection           │
│ • poll:{id}:weighted (Hash)  │              │ • votelogs audit collection  │
│ • poll:{id}:m:{unix} (TTL)   │              │                              │
│ • poll:{id}:leaderboard (ZSet│              │ (Asynchronous Write-Behind / │
│ • Pub/Sub Broadcast Fanout   │              │  Cold Cache Rebuild Source)  │
└──────────────────────────────┘              └──────────────────────────────┘
```

1. **Redis as the Realtime Source of Truth**: All active session counters (`poll:{id}:counts`), voter deduplication sets (`poll:{id}:voters`), confidence aggregates (`poll:{id}:weighted`), per-second momentum tallies (`poll:{id}:m:{sec}`), and quiz scoreboards (`poll:{id}:leaderboard`) live directly in Redis memory.
2. **Atomic Lua Vote Script**: Every vote execution runs within a single atomic Lua script on Redis. The script tests poll closure, deduplicates the voter fingerprint, increments standard and weighted tallies, updates sliding momentum windows, computes optional quiz scores, and publishes the serialized update payload to the Redis channel—eliminating race conditions and duplicate vote fraud under high concurrency.
3. **Dual Realtime Transport (SSE + WebSocket)**: The backend subscribes to Redis pub/sub and multiplexes broadcast events to client connections via a non-blocking in-memory Hub. Clients consume streams over Server-Sent Events (`/polls/:id/stream`) or WebSockets (`/polls/:id/ws`).
4. **Cold-Cache Self-Healing Rebuild**: If Redis evicts memory or restarts, poll handlers automatically rebuild vote tallies and confidence weights by executing an aggregation pipeline over the MongoDB `votelogs` audit collection and repopulating Redis keys on demand.

---

## Feature Matrix

### Core Flow
- **Authentication**: JWT-based user authentication using secure bcrypt password hashing.
- **Poll Creation**: Custom question builder with 2 to 10 options, configurable expiry deadlines, and toggleable hidden results.
- **Instant Join**: Human-friendly 6-character alphanumeric join codes (with ambiguity-safe character set) and auto-generated QR codes.
- **Voting Experience**: Zero-login voting protected by anonymous client token (`voterToken`) combined with hashed IP identifiers.
- **Realtime Results**: Instant bar chart recalculation driven by SSE/WebSocket broadcasts without browser polling.

### Beyond the Brief
- **Confidence-Weighted Voting**: Voters indicate confidence (1–5 scale). Hosts can toggle between raw headcount and confidence-weighted percentage distributions.
- **Quiz Mode & Live Leaderboard**: Speed-scored competitive mode where correct answers score points decaying linearly from 1,000 to 200 based on answer response time, ranked in real time using Redis Sorted Sets (`ZADD`/`ZREVRANGE`).
- **Live Ephemeral Reactions**: Floating emoji burst animations broadcasted across all connected viewers via Redis Pub/Sub without persistent database overhead.
- **Live Momentum Sparkline**: 60-second sliding window velocity tracking votes per second via Redis TTL keys.
- **Results Visibility Control**: Host can hide results during voting and reveal them synchronously when ready.
- **Automated Expiry Watcher**: Background goroutine checking expiring sessions every 30 seconds, closing polls and pushing instant close events to viewers.

---

## Project Structure

```
guvi-hcl/
├── backend/
│   ├── internal/
│   │   ├── config/          # Environment configuration loading & validation
│   │   ├── db/              # MongoDB & Redis connection initializers
│   │   ├── handlers/        # HTTP & WebSocket route controllers
│   │   │   ├── auth.go      # Signup & login handlers with JWT issuing
│   │   │   ├── polls.go     # Poll CRUD, Lua vote execution, cold cache rebuild
│   │   │   ├── quiz.go      # Leaderboard query handlers
│   │   │   ├── reactions.go # Ephemeral emoji pub/sub dispatch
│   │   │   ├── stream.go    # Server-Sent Events (SSE) streaming handler
│   │   │   ├── ws.go        # WebSocket upgrade & stream pump handler
│   │   │   ├── health.go    # Dependency liveness & readiness probes
│   │   │   └── errors.go    # Safe error normalization & timeout translation
│   │   ├── middleware/      # JWT auth, optional auth, and sliding-window rate limiters
│   │   ├── models/          # MongoDB BSON & JSON document schemas
│   │   ├── realtime/        # Redis pub/sub listener hub & auto-expiry background worker
│   │   └── validation/      # Input sanitization and join-code normalization
│   ├── .env.example         # Template for backend environment variables
│   ├── go.mod               # Go module dependencies
│   ├── go.sum               # Cryptographic checksums of Go dependencies
│   └── main.go              # Application entrypoint & HTTP server lifecycle
├── frontend/
│   ├── public/              # Static SVG icons and favicon assets
│   ├── src/
│   │   ├── api/             # Typed API client wrapper (fetch)
│   │   ├── components/      # UI components (GlassCard, PollBarsCanvas, AmbientGlow)
│   │   │   └── ui/          # Primitives (Button, Input, Badge, Tag)
│   │   ├── hooks/           # usePollStream realtime hook
│   │   ├── lib/             # Auth storage, voterToken generation, intersection observer
│   │   ├── pages/           # LandingPage, CreatePollPage, ManagePollPage, VotePage, Dashboard
│   │   ├── App.tsx          # Client-side router configuration
│   │   └── main.tsx         # React root mounting
│   ├── .env.example         # Template for frontend environment variables
│   ├── package.json         # Scripts and NPM package dependencies
│   ├── tailwind.config.js   # Tailwind design tokens
│   ├── tsconfig.json        # TypeScript configuration
│   └── vite.config.ts       # Vite bundler configuration
├── docs/                    # Documentation assets & screenshots
└── README.md                # Project documentation
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Source / Example |
|---|---|---|
| `PORT` | Local or container listening port | Default `8080` (Railway automatically sets this) |
| `MONGO_URI` | MongoDB connection URI string | MongoDB Atlas cluster connection string (`mongodb+srv://...`) |
| `REDIS_URL` | Redis connection URL | Upstash Redis connection string (`rediss://default:...@endpoint.upstash.io:6379`) |
| `JWT_SECRET` | Secret key for signing authentication JWTs | 64-character random hex string (`openssl rand -hex 32`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s), comma-separated | `http://localhost:5173,https://your-frontend.vercel.app` |

### Frontend (`frontend/.env`)

| Variable | Description | Source / Example |
|---|---|---|
| `VITE_API_URL` | Base HTTP endpoint for the backend API | Local: `http://localhost:8080`, Production: `https://your-backend.railway.app` |
| `VITE_DEMO_POLL_ID` | Optional pre-created poll ID for the landing page demo | Valid MongoDB ObjectID hex string |

---

## Local Development Setup

### Prerequisites
- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/) & `npm`
- A free MongoDB Atlas cluster & Upstash Redis instance (or local Docker containers)

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create your local environment file
cp .env.example .env
# Fill in your MONGO_URI, REDIS_URL, and JWT_SECRET in .env

# Download Go dependencies
go mod download

# Run the backend server
go run main.go
```
The backend will boot on `http://localhost:8080`. Verify liveness by visiting `http://localhost:8080/health`.

### 2. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Create your local environment file
cp .env.example .env
# Ensure VITE_API_URL=http://localhost:8080 is set

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## API Endpoint Reference

| Method | Endpoint | Auth Required | Description |
|---|---|:---:|---|
| `GET` | `/health` | No | Liveness and dependency status probe (MongoDB & Redis pings) |
| `POST` | `/auth/signup` | No | Register a new host account (rate-limited) |
| `POST` | `/auth/login` | No | Authenticate host and receive bearer JWT (rate-limited) |
| `GET` | `/polls/join/:joinCode` | No | Resolve a 6-character join code to a poll ID |
| `GET` | `/polls/:id` | Optional | Retrieve poll configuration, options, and current vote counts |
| `GET` | `/polls/:id/stream` | No | Server-Sent Events (SSE) endpoint for real-time live updates |
| `GET` | `/polls/:id/ws` | No | WebSocket transport for real-time live updates |
| `GET` | `/polls/:id/leaderboard`| No | Fetch top-10 speed-scored quiz participants |
| `POST` | `/polls/:id/vote` | No | Cast an anonymous vote with confidence and voter fingerprint (rate-limited) |
| `POST` | `/polls/:id/react` | No | Broadcast ephemeral reaction emoji to session viewers (rate-limited) |
| `POST` | `/polls` | **Yes (JWT)** | Create a new poll with options, expiry, and quiz settings |
| `GET` | `/polls/mine` | **Yes (JWT)** | List all polls created by the authenticated host |
| `POST` | `/polls/:id/close` | **Yes (JWT)** | Close an active poll to prevent further voting |
| `PATCH`| `/polls/:id/reveal`| **Yes (JWT)** | Reveal previously hidden results to participants |
| `DELETE`| `/polls/:id` | **Yes (JWT)** | Permanently delete a poll, purge its Redis state, and notify viewers |
| `GET` | `/polls/:id/momentum` | **Yes (JWT)** | Fetch 60-second sliding-window voting velocity |

---

## Key Engineering Decisions

- **Atomic Lua Script for Zero-Race Voting**: Rather than coordinating multi-step transactions across network hops (read voter set -> verify status -> increment counter -> publish event), the entire voting operation runs atomically on the Redis engine via Lua. This completely prevents double-voting races even when hundreds of votes hit the cluster simultaneously.
- **Dual Stream Architecture (SSE Default with WebSocket Fallback)**: Server-Sent Events (SSE) was selected as the primary broadcast protocol because live polling is fundamentally unidirectional (server to audience). SSE offers automatic browser reconnection, HTTP/2 multiplexing, and zero protocol switching overhead. A WebSocket endpoint is also provided for environments requiring bi-directional socket symmetry.
- **Ephemeral Fire-and-Forget Reactions**: Real-time emoji bursts are published directly to the Redis channel and dispatched to connected streams without ever hitting persistent disks or generating database write amplification.
- **Cold-Cache Self-Healing Strategy**: Live tally state resides in Redis for microsecond retrieval, but durability is preserved through asynchronous MongoDB `votelogs`. In the event of Redis key eviction or server cold-boot, the system lazily aggregates MongoDB audit rows to reconstruct tallies transparently without manual intervention.

---

## Development Notes

Built with Claude Code as an AI pair-programming assistant for rapid architectural scaffolding and implementation iteration.

---

## License

MIT License. Designed and developed by **aadhi590**.
