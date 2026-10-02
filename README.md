# Pulse

An API gateway and asynchronous job orchestration platform, built to demonstrate production-style backend engineering: queues, async workers, resilience patterns, observability, auth, and database design — not just CRUD.

A client submits a job, the system validates and stores it, queues the work, and a separate worker process picks it up and runs it against downstream services. The project deliberately introduces failure (via configurable mock services) so real resilience mechanisms — retries, circuit breakers, rate limiting — have something genuine to react to.

---

## Architecture

```
Client → API (Fastify) → PostgreSQL
                ↓
         Redis / BullMQ Queue
                ↓
    Worker → Downstream Services (mocked)
                ↓
      Retry + Circuit Breaker (planned)
                ↓
       Logs / Metrics / Tracing (planned)
```

The API and the worker are **separate processes**, connected only through Redis. This means the API responds instantly to job creation without waiting for the work itself to finish, and the two can fail or scale independently of each other.

---

## Tech stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript (strict mode) |
| Framework | Fastify |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Queue | Redis + BullMQ |
| API docs | Swagger / OpenAPI (via `@fastify/swagger`) |
| Containers | Docker (Redis) |

---

## Database design

Three core models:

- **`User`** — account, role (`CUSTOMER` / `ADMIN`)
- **`Job`** — a unit of async work: `type`, `payload` (JSON, shape varies by job type), `status` (state machine: `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED` / `RETRYING` / `CANCELLED`)
- **`JobAttempt`** — one row per processing attempt, giving a full audit trail per job rather than just a single overwritten status

Notable design decisions:
- `Job.userId` uses `onDelete: SetNull` — jobs outlive a deleted user, for audit purposes.
- `JobAttempt.jobId` uses `onDelete: Cascade` — attempts are meaningless without their parent job.
- Retry counts are **computed** from `JobAttempt` rows (`count()`) rather than stored as a running counter on `Job`, to avoid two sources of truth drifting out of sync.
- Job payloads are passed through the queue as a **reference** (`{ jobId }`) rather than a full data snapshot — the worker always re-fetches current state from Postgres before processing, so a cancellation or update made after queuing is never missed.

---

## Getting started

```bash
# install dependencies
npm install

# copy env template and fill in your DATABASE_URL
cp .env.example .env

# run migrations
npx prisma migrate dev

# start Redis (requires Docker)
docker run -d --name pulse-redis -p 6379:6379 redis

# start the API
npm run dev

# in a separate terminal, start the worker
npm run worker
```

API docs available at `http://localhost:3000/docs` once running.

---

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/jobs` | Create a job (enqueues for async processing) |
| `GET` | `/jobs/:id` | Retrieve a job, including its attempt history |
| `GET` | `/jobs` | List all jobs |
| `DELETE` | `/jobs/:id` | Cancel a job *(planned)* |
| `GET` | `/health` | Health check |
| `GET` | `/health/circuit-breakers` | Inspect circuit breaker states *(planned)* |
| `POST` | `/chaos/:service` | Configure simulated downstream failures *(planned)* |

---

## Roadmap

- [x] **Phase 1 — Core Backend**: Fastify + TypeScript service, PostgreSQL schema, Prisma integration, job CRUD, request validation, Swagger docs
- [x] **Phase 2 — Async Processing**: Redis + BullMQ, queue/worker split, full job state tracking, per-attempt audit logging
- [ ] **Phase 3 — Downstream Services**: mock Customer, Payment, and Notification services with configurable latency/failure rates
- [ ] **Phase 4 — Resilience**: timeouts, retries with exponential backoff, circuit breakers
- [ ] **Phase 5 — Rate Limiting**: per-user/API limits via Redis
- [ ] **Phase 6 — Idempotency**: `Idempotency-Key` support to prevent duplicate job creation
- [ ] **Phase 7 — Authentication**: JWT + role-based access control
- [ ] **Phase 8 — Observability**: structured logging, request IDs, metrics, distributed tracing
- [ ] **Phase 9 — Chaos Mode**: admin-controlled failure simulator
- [ ] **Phase 10 — Production Polish**: Docker, CI/CD, load testing, deployment

---

## Why this project exists

Built as a hands-on way to move beyond tutorial-level CRUD and demonstrate real backend engineering concerns: distributed systems basics, failure handling, and production-style trade-offs — the kind of thing that's hard to show convincingly without actually building and breaking it.
