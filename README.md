# TaskFlow

TaskFlow is a portfolio-scale background-job platform. An Express API accepts authenticated job requests quickly, BullMQ stores delivery and retry state in Redis, and a separate Node worker performs the work. MongoDB stores the durable user-facing record, result, and error history.

## What it demonstrates

- API requests do not wait for report generation or email delivery.
- Separate API and worker processes communicate through BullMQ/Redis.
- Configurable attempts, exponential backoff, priority, and worker concurrency.
- User-scoped idempotency keys and user-scoped authorization.
- Persistent lifecycle states: `queue_pending`, `queued`, `active`, `completed`, `failed`, and `cancelled`.
- Scheduled jobs, owner-only cancellation, manual failed-job retry, and an event timeline.
- A React monitoring dashboard backed by real API data.

## Repository layout

```text
taskflow/
  client/       React, Vite, Tailwind dashboard
  server/       Express API, Mongo models, BullMQ worker
  docker-compose.yml  local Redis only
```

## Local setup

Prerequisites: Node 20+, a MongoDB Atlas connection string, and Redis (Docker Desktop is the easiest local option).

```bash
cd taskflow
copy .env.example .env
docker compose up --build
npm install
npm run dev:api
```

In two more terminals:

```bash
cd taskflow
npm run dev:worker
npm run dev:web
```

Open `http://localhost:5173`. Set `VITE_API_URL` during frontend deployment when the API is not local.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account and receive a JWT |
| `POST` | `/api/auth/login` | Log in and receive a JWT |
| `POST` | `/api/jobs` | Submit a background job |
| `GET` | `/api/jobs` | List the current user's jobs |
| `GET` | `/api/jobs/:id` | Fetch a current user's job |
| `POST` | `/api/jobs/:id/cancel` | Cancel a waiting job |
| `POST` | `/api/jobs/:id/retry` | Start a fresh retry cycle for a failed job |
| `GET` | `/api/jobs/stats` | Dashboard counters |
| `POST` | `/api/jobs/recover-pending` | Re-enqueue durable records pending after a Redis failure |

All job routes require `Authorization: Bearer <token>`. Submission additionally requires a client-generated `Idempotency-Key` header.

```bash
curl -X POST http://localhost:4000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 1af430db-809f-4a8d-bc78-f4c8c8b9685d" \
  -H "Content-Type: application/json" \
  -d '{"type":"email","payload":{"to":"hello@example.com","subject":"Welcome"},"priority":2,"attempts":3}'
```

`email` and `report` are intentional simulations. Include `"simulateFailure": true` in the payload to observe retry and failed-job behavior.

Add an optional future ISO-8601 `scheduledAt` value to defer a job by up to 30 days. This uses BullMQ delayed jobs; the record remains `queued` until processing begins.

## Lifecycle and reliability choices

1. The API creates a MongoDB job record first with `queue_pending`.
2. It then adds the job to BullMQ and updates the document to `queued`.
3. The worker marks it `active`, records attempts, then writes a result or error to MongoDB.
4. BullMQ retries failed execution with an exponential delay of 1 second, then 2 seconds, then 4 seconds.

This avoids silently losing a job when MongoDB succeeds but Redis is unavailable. It is not a transactional outbox: recovery is manual through the authenticated endpoint for this project. A production system would normally run a scheduled recovery process or use an outbox relay.

The unique `(owner, idempotencyKey)` index makes repeated HTTP requests return the first job. Worker handlers also return early for already-completed records. Real external effects need an idempotency key at the provider or business-operation level too; a database check alone cannot guarantee exactly-once delivery across a process crash.

## Testing

```bash
npm test
npm run build
```

The automated tests cover the public health endpoint, authentication boundary, duplicate submission behavior, and handling of an enqueue failure. For end-to-end verification, register two users, submit a job as the first, retrieve it as the second (expect `404`), submit a duplicate idempotency key (expect the original job), and submit a simulated failure (expect retried attempts followed by `failed`).

GitHub Actions runs the backend tests and frontend production build on pushes and pull requests. The Docker Compose setup runs MongoDB, Redis, API, and worker together for a closer-to-deployment local test.

## Deployment

Deploy the static frontend to Vercel or Render Static Sites. Deploy **two separate services** from `server/`: one with `npm start`, one with `npm run worker`. Use MongoDB Atlas and a managed Redis provider. Set all values from `.env.example` as secrets, including `CLIENT_URL` and `VITE_API_URL`.

The platform guidance below was checked on October 22, 2026. Do not host the worker on Vercel Functions: functions have a maximum execution duration and cannot serve as a continuously connected BullMQ consumer. Render documents its free instances for web services, static sites, Postgres, and Key Value, not Background Workers; its free web services also spin down after 15 minutes with no inbound traffic. A credible deployment therefore uses Vercel/Render for the dashboard, a web service for the API, and a paid always-on Render Background Worker (or another persistent container host) for `npm run worker`. Render's own worker guide explicitly lists BullMQ as a Node.js queue framework. Recheck host pricing before launch because plans change.

`render.yaml` is a starting blueprint for the API and worker. It intentionally leaves MongoDB/Redis URLs and the browser origin as dashboard-supplied secrets. Deploy the frontend separately and set `VITE_API_URL` to the API's public `/api` URL.

## Honest limitations

- The dashboard polls every five seconds rather than using websockets.
- The recovery endpoint is user-triggered, not an automated outbox relay.
- The simulated handlers do not contact email or report services.
- This project has no multi-region failover, distributed tracing, or production alerting.
- BullMQ guarantees at-least-once execution, so every real side effect must be designed to tolerate repeats.

## Interview prompts

- Why use Redis/BullMQ instead of a database table and a cron loop?
- What happens when MongoDB writes successfully but Redis is down?
- Why does retry require idempotent worker code?
- How does lower numeric BullMQ priority affect scheduling?
- Why must the API and worker be independently deployable?
# TaskFlow
