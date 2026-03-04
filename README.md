# Gym Capacity & Booking System

A cloud-native feature for viewing real-time gym capacity and booking workout slots during peak hours. Built as a vertical slice across three layers: API, mobile UI, and infrastructure.

## Project Structure

```
gym/
├── api/          → Fastify REST API (TypeScript)
├── mobile/       → React Native / Expo screen
└── infra/        → AWS CDK stack
```

## Quick Start

### API

```bash
cd api
npm install
npm run dev      # starts on http://localhost:3000
npm test         # runs vitest suite
```

**Endpoints:**

| Method | Route              | Description                              |
| ------ | ------------------ | ---------------------------------------- |
| GET    | /gyms/:id/capacity | Current capacity (% + counts)            |
| POST   | /gyms/:id/book     | Book a slot (body: `{ userId, slotId }`) |

Seeded gyms: `gym-1` (Downtown Flex), `gym-2` (Uptown Iron).

### Mobile

```bash
cd mobile
npm install
npx expo start
```

The app connects to `localhost:3000` by default. Make sure the API is running first.

### Infrastructure

```bash
cd infra
npm install
npx cdk synth     # synthesise CloudFormation template
npx cdk deploy    # deploy to AWS
```

---

## Architectural Decisions

### Concurrency: Optimistic Locking

The core challenge in the booking system is preventing overbooking when many users try to book the last few slots simultaneously (e.g. Monday at 6 PM).

I chose **optimistic concurrency control** over pessimistic locking (mutexes/row locks). Here's why:

1. **Scalability.** Pessimistic locks (in-process mutexes) don't work when you have multiple Lambda instances handling requests in parallel — each instance has its own memory. Optimistic locking works across instances because the check happens at the database level.

2. **How it works.** Every time slot carries a `version` counter. When a booking is made:
   - Read the slot and note its `version`.
   - Validate business rules (capacity check, duplicate check).
   - Persist the booking with a condition: "only if `version` still equals what I read."
   - If someone else booked in between, the write is rejected → retry from step 1.

3. **In a real database**, this translates to:
   - **DynamoDB:** `ConditionExpression: "version = :expected"` on a `PutItem` / `UpdateItem`
   - **PostgreSQL:** `UPDATE slots SET booked_count = booked_count + 1, version = version + 1 WHERE id = $1 AND version = $2 RETURNING *`

The retry loop is capped at 3 attempts. Under normal load, the first attempt succeeds. Under extreme contention, the retries absorb the conflict gracefully.

### Repository / Service Pattern

The code is structured in three layers:

```
Route Handlers → BookingService → GymRepository (interface)
                                      ↑
                              InMemoryGymRepository (implementation)
```

- **Route handlers** only deal with HTTP concerns (parsing, validation, status codes).
- **BookingService** owns all business logic and orchestrates the retry loop.
- **GymRepository** is an interface — the in-memory implementation can be swapped for DynamoDB without touching the service.

This makes the booking logic independently testable (the tests don't need an HTTP server or a database).

### Mobile State Management

The mobile app uses **discriminated unions** for async state instead of separate boolean flags:

```typescript
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };
```

This eliminates impossible states at the type level — you can never have `isLoading: true` and `error: "something"` at the same time, which is a common source of UI bugs.

### Infrastructure

- **HTTP API (v2)** over REST API (v1): ~70% cheaper, lower latency, sufficient for our needs.
- **Single Lambda** for all routes: simpler cold-start management and deployment for a small API.
- **ARM64 architecture**: better price/performance ratio on AWS Graviton.

---

## Trade-offs & Future Improvements

| Current State                            | What I'd Change With More Time                                |
| ---------------------------------------- | ------------------------------------------------------------- |
| In-memory mock database                  | DynamoDB with conditional writes for real persistence         |
| Polling (10s interval) for live capacity | Server-Sent Events or WebSocket via API Gateway WebSocket API |
| No authentication                        | Cognito User Pool + JWT validation middleware                 |
| Hardcoded gym/user IDs in mobile         | Navigation params + auth context                              |
| No input validation beyond JSON schema   | Zod or Typebox for runtime validation with type inference     |
| No CI/CD pipeline                        | GitHub Actions: lint → test → cdk deploy                      |
| Single region                            | Multi-region with DynamoDB Global Tables                      |

---

## Bonus: ElastiCache for the Capacity Endpoint

For a global user base where thousands of users might poll the capacity endpoint simultaneously, we'd put an **ElastiCache (Redis)** layer between the Lambda and DynamoDB:

```
Client → API Gateway → Lambda → Redis (check cache)
                                   ├─ HIT  → return cached data
                                   └─ MISS → query DynamoDB → write to cache (TTL: 5-10s) → return
```

**Why this works well for capacity data:**

1. **Capacity doesn't need millisecond freshness.** A 5-10 second TTL is perfectly acceptable — users won't notice the difference between "68% full" and "69% full."

2. **Write-through on booking.** When a booking succeeds, we update both DynamoDB and Redis atomically. This ensures the cache reflects bookings immediately (the most impactful updates) while still tolerating some staleness for general occupancy changes (people walking in/out).

3. **Global distribution.** ElastiCache Global Datastore replicates across regions with sub-second lag, so users in Europe and Asia see the same data without cross-region DB queries.

4. **Cost reduction.** Redis reads are microseconds vs. DynamoDB's single-digit milliseconds, and you avoid paying for DynamoDB read capacity units on the hot path.

The CDK addition would look like:

```typescript
const cacheCluster = new elasticache.CfnCacheCluster(this, "CapacityCache", {
  cacheNodeType: "cache.t4g.micro",
  engine: "redis",
  numCacheNodes: 1,
  vpcSecurityGroupIds: [cacheSecurityGroup.securityGroupId],
});
```

With the Lambda placed inside the same VPC as the cache cluster.
# gym
