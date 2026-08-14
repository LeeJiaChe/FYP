# Architecture v2

Status: **Proposed; not yet implemented**

Decision date: 2026-08-14

Companion audit: [`ARCHITECTURE_AUDIT_2026-08-14.md`](./ARCHITECTURE_AUDIT_2026-08-14.md)

This document is the normative architecture proposal for the TAR UMT Campus
Shuttle Management System. `APP_SPECIFICATION.md` remains the product source of
truth. Where that specification is ambiguous or internally inconsistent, the
questions in the companion audit must be resolved before the affected rule is
implemented.

## 1. Architecture decision

Use a **feature-oriented modular monolith** in the Next.js application, plus the
already-required standalone Socket.io process.

The system therefore has three runtime units, not a fleet of services:

1. The browser/PWA.
2. One Next.js application containing pages, HTTP endpoints, use cases, domain
   rules, and Prisma persistence.
3. One small realtime process that broadcasts ephemeral updates and invokes
   idempotent scheduled-job endpoints.

PostgreSQL remains the authoritative datastore. The realtime process never owns
business state. If realtime delivery fails, committed PostgreSQL state remains
correct and clients recover by refetching.

This is intentionally not microservices, CQRS, event sourcing, a generic
repository framework, or an internal event bus. Those patterns do not solve a
current FYP need and would make the system harder to explain and test.

## 2. Design goals

- One authoritative implementation for every state transition.
- Authorization and data minimization close to the use case and data source.
- Thin Next.js pages and Route Handlers.
- Pure, directly testable domain policies.
- Explicit transactions for every multi-row invariant.
- Feature ownership that a future engineer or Codex session can identify from
  the path alone.
- A demo that remains useful if Socket.io is temporarily unavailable.
- No abstraction without a current consumer and a testable benefit.

## 3. Runtime and responsibility map

| Runtime/layer | Owns | Must not own |
|---|---|---|
| Browser/PWA | Rendering, interaction state, forms, optimistic/pending UI, Socket.io subscription, refetch after events | Authorization, credit calculations, state-transition decisions, secrets |
| Next.js route shell | URLs, layouts, loading/error boundaries, composition of server and client components | Raw Prisma queries or duplicated business rules |
| HTTP transport | Parse request, validate contract, call one use case, map typed result/error to HTTP | Transactions, direct cross-table mutation logic |
| Application/use cases | Authorization, orchestration, transaction boundary, domain-policy calls, DTO result | JSX, HTTP response construction, Socket.io connections |
| Domain | State machines, cutoffs, credit policy, waitlist ordering rules, invariant checks | Next.js, Prisma, environment variables, network calls |
| Feature persistence | Minimal Prisma queries required by that feature | Generic CRUD wrappers, UI types, cross-feature policy |
| PostgreSQL | Durable source of truth, foreign keys, unique/check constraints, indexes | Ephemeral socket connection state |
| Realtime process | Authenticated rooms, internal emit endpoint, cron trigger | Prisma access, authorization policy, durable events, business transitions |
| Notification module | In-app notification records and safe DTOs | Email, SMS, push infrastructure unless separately approved |

## 4. Feature ownership

| Feature | Owns |
|---|---|
| `identity` | Registration, login/logout, password changes, session validation, current-user DTO, role policies |
| `fleet` | Buses, routes, ordered stops, soft-delete/retirement policy |
| `trips` | Trip scheduling, driver assignment, trip lifecycle, per-trip seat inventory |
| `bookings` | Seat reservation, waitlist, cancellation/promotion, booking history |
| `boarding` | QR issue/verification and QR/manual check-in; uses booking and trip public application APIs |
| `penalties` | No-show penalty, credit score, booking restriction, appeals |
| `notifications` | In-app notification creation, listing, read state, departure reminders |
| `monitoring` | Seat/trip monitoring DTOs and simulated device-health logs |
| `analytics` | Historical, read-only aggregates and rule-based recommendations |
| `jobs` | Idempotent entry points for no-show, reminders, and device simulation; orchestration only |

`boarding` is separate from `bookings` because scanning is a driver workflow with
different authorization and timing rules. It does not get its own persistence
model. `jobs` is not a business domain; it invokes application use cases owned by
the relevant features.

## 5. Exact proposed folder structure

The move to `src/` is deliberate: project configuration, migrations, runtime
services, and documentation remain visibly separate from application source.
Next.js 16 explicitly supports `src/app` and `src/proxy.ts`.

```text
FYPBusSystem/
├── .env.example
├── .github/
│   └── workflows/ci.yml
├── AGENTS.md
├── CLAUDE.md                        # compatibility pointer to AGENTS.md
├── README.md
├── NOTES.md
├── package.json
├── package-lock.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── prisma.config.ts
├── docs/
│   ├── reference/
│   │   ├── fyp-proposal.md
│   │   └── fyp-proposal-moderation.md
│   └── audits/
│       ├── legacy-code-review.md
│       └── legacy-ui-ux-review.md
├── framework/
│   ├── APP_SPECIFICATION.md
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE_AUDIT_2026-08-14.md
│   ├── DEFINITION_OF_DONE.md
│   ├── ENGINEERING_PRINCIPLES.md
│   ├── PROJECT_CONSTITUTION.md
│   └── PROJECT_REVIEW_CHECKLIST.md
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── icon-maskable-512.png
│   └── sw.js                         # only when offline scope is approved
├── realtime/
│   ├── server.ts                     # composition root only
│   ├── config.ts
│   ├── authenticate-socket.ts
│   ├── emit-handler.ts
│   ├── rooms.ts
│   └── scheduler.ts
├── src/
│   ├── proxy.ts                      # optimistic page redirects only
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── manifest.ts
│   │   ├── global-error.tsx
│   │   ├── not-found.tsx
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (portals)/
│   │   │   ├── student/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── driver/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   └── page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── me/route.ts
│   │       │   └── change-password/route.ts
│   │       ├── admin/
│   │       │   ├── buses/route.ts
│   │       │   ├── buses/[id]/route.ts
│   │       │   ├── routes/route.ts
│   │       │   ├── routes/[id]/route.ts
│   │       │   ├── drivers/route.ts
│   │       │   └── drivers/[id]/route.ts
│   │       ├── routes/route.ts       # authenticated schedule lookup
│   │       ├── trips/route.ts
│   │       ├── trips/[id]/route.ts
│   │       ├── trips/[id]/scan/route.ts
│   │       ├── trips/[id]/manual-checkin/route.ts
│   │       ├── bookings/route.ts
│   │       ├── bookings/mine/route.ts
│   │       ├── bookings/[id]/cancel/route.ts
│   │       ├── bookings/[id]/qr-token/route.ts
│   │       ├── penalties/mine/route.ts
│   │       ├── penalties/[id]/appeal/route.ts
│   │       ├── appeals/route.ts
│   │       ├── appeals/[id]/route.ts
│   │       ├── notifications/mine/route.ts
│   │       ├── notifications/[id]/read/route.ts
│   │       ├── analytics/utilization/route.ts
│   │       ├── analytics/no-show-rate/route.ts
│   │       ├── realtime/token/route.ts
│   │       └── internal/jobs/
│   │           ├── no-shows/route.ts
│   │           ├── reminders/route.ts
│   │           └── device-health/route.ts
│   ├── features/
│   │   ├── identity/
│   │   │   ├── contracts/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   ├── ui/
│   │   │   ├── public.ts
│   │   │   └── server.ts
│   │   ├── fleet/                    # same internal shape
│   │   ├── trips/                    # same internal shape
│   │   ├── bookings/                 # same internal shape
│   │   ├── boarding/                 # same internal shape
│   │   ├── penalties/                # same internal shape
│   │   ├── notifications/            # same internal shape
│   │   ├── monitoring/               # same internal shape
│   │   ├── analytics/                # same internal shape
│   │   └── jobs/
│   │       ├── application/
│   │       └── server.ts
│   └── shared/
│       ├── config/
│       │   ├── env.server.ts
│       │   └── constants.ts
│       ├── db/
│       │   ├── prisma.ts
│       │   └── transaction.ts
│       ├── http/
│       │   ├── api-error.ts
│       │   ├── api-response.ts
│       │   ├── handle-route.ts
│       │   └── origin-check.ts
│       ├── realtime/
│       │   ├── event-contracts.ts
│       │   └── publisher.server.ts
│       ├── time/
│       │   └── clock.ts
│       ├── ui/
│       │   ├── modal.tsx
│       │   ├── confirm-dialog.tsx
│       │   ├── form-field.tsx
│       │   ├── empty-state.tsx
│       │   └── status-badge.tsx
│       └── types/
│           └── branded-id.ts
└── tests/
    ├── unit/
    │   ├── bookings/
    │   ├── trips/
    │   └── penalties/
    ├── integration/
    │   ├── auth/
    │   ├── booking-lifecycle/
    │   ├── boarding/
    │   ├── no-show/
    │   └── appeals/
    ├── contract/
    │   ├── api/
    │   └── realtime/
    ├── e2e/
    │   ├── student-booking.spec.ts
    │   ├── driver-boarding.spec.ts
    │   └── admin-operations.spec.ts
    ├── architecture/
    │   └── dependency-rules.test.ts
    └── support/
        ├── factories.ts
        ├── test-db.ts
        └── authenticated-client.ts
```

This is the final v2 tree, not a request to move everything at once. Portal URLs
remain stable. Internal API callers migrate one feature at a time; where v2
normalizes an existing endpoint (for example, merging the two current driver
endpoints), the old adapter remains only until its callers switch and never owns
parallel business logic.

Each feature uses only the subfolders it needs. Empty layers must not be created
to make the tree look symmetrical. A typical server-side feature is:

```text
features/bookings/
├── contracts/
│   ├── booking.schemas.ts
│   └── booking.dto.ts
├── domain/
│   ├── booking-status.ts
│   ├── cancellation-policy.ts
│   └── waitlist-policy.ts
├── application/
│   ├── create-booking.ts
│   ├── cancel-booking.ts
│   ├── list-my-bookings.ts
│   └── ports.ts
├── infrastructure/
│   └── booking.prisma.ts
├── ui/
│   ├── booking-list.tsx
│   └── seat-picker.tsx
├── public.ts                         # browser-safe contracts/UI only
└── server.ts                         # server-only use-case facade
```

## 6. Dependency rules

These rules are deliberately short enough to enforce with ESLint and an
architecture test.

1. `src/app` may import feature `public.ts`, feature `server.ts`, and `shared/ui`.
   Route Handlers call one feature use case through `server.ts`.
2. UI and browser-safe `public.ts` files may never import Prisma, Node-only
   modules, secrets, `server.ts`, or `infrastructure`.
3. `domain` imports only its own feature's domain types and dependency-free
   shared value types. It never imports React, Next.js, Prisma, or `process.env`.
4. `application` may import its own `domain`, its declared ports, and another
   feature only through that feature's `server.ts` facade. Deep cross-feature
   imports are forbidden.
5. `infrastructure` implements local application ports and may import Prisma
   through `shared/db`. It must not contain business-policy decisions.
6. Only `shared/db/prisma.ts` constructs `PrismaClient`. Direct Prisma access is
   limited to feature `infrastructure` and migration/seed tooling.
7. `shared` imports no feature. If a helper is useful to only one feature, it
   stays in that feature.
8. `realtime/` imports only shared realtime contracts and its own code. It never
   imports Prisma or feature use cases.
9. Tests may deep-import the unit they test. Production code may not bypass a
   feature's public facade.
10. `server-only` marks server facades, persistence, session, environment, QR,
    and realtime-publisher modules. Client modules use explicit `use client` at
    the smallest interactive boundary.

Allowed dependency direction:

```text
app/transport -> feature application -> feature domain
                         |
                         v
                 feature ports <- feature infrastructure -> shared/db

feature UI -> feature public contracts -> shared UI/types
realtime process -> shared realtime contracts
```

## 7. Request and data-flow rules

### Reads

- Server Components read through feature query use cases directly; they do not
  make HTTP calls to this application's own Route Handlers.
- Client Components use Route Handlers only where browser interaction, polling,
  or realtime refetch requires it.
- Queries select explicit fields and return dedicated DTOs. Prisma records are
  never passed wholesale to Client Components.
- Student, driver, and admin query policies are separate. A driver manifest
  query must prove that the trip is assigned to that driver.

### Mutations

The standard mutation flow is:

```text
Route Handler
  -> validate params/query/body with Zod
  -> establish current actor from the live session
  -> invoke one use case
  -> use case authorizes the actor and resource
  -> acquire needed lock(s) and run one Prisma transaction
  -> commit state plus in-app notifications
  -> publish a best-effort realtime invalidation event
  -> return a minimal DTO through the common HTTP mapper
```

All errors are typed (`Unauthenticated`, `Forbidden`, `NotFound`, `Conflict`,
`Validation`, `InvariantViolation`, `Internal`) and mapped once. Unexpected
errors are logged server-side with a correlation ID and return a generic message.

### Transactions and concurrency

- Lock the aggregate coordinator row (`Trip`) before booking, cancellation,
  promotion, check-in, or no-show mutation for that trip.
- Re-read mutable state after the lock is acquired. Pre-transaction snapshots
  must not drive a write.
- No-show processing uses a conditional status transition and a database unique
  constraint on `Penalty.bookingId`, making retries safe.
- Appeal decisions lock and re-read the appeal, penalty, and live student credit
  score in the same transaction.
- State-changing use cases are safe when invoked twice or return a typed conflict.
- Realtime publication occurs only after commit. A failed publication never
  rolls back durable state.

## 8. State ownership and transitions

No Route Handler may assign enum values directly without calling the owning
domain transition policy.

### Booking

```text
WAITLISTED -> CONFIRMED | CANCELLED
CONFIRMED  -> COMPLETED | CANCELLED | NO_SHOW
COMPLETED, CANCELLED, NO_SHOW -> terminal
```

`Seat.status` changes in the same transaction as its booking. Seat availability
is based on per-trip seat rows, never the bus's current mutable capacity.

### Penalty and appeal

```text
Penalty: ACTIVE -> APPEALED -> OVERTURNED | UPHELD
Appeal:  PENDING -> APPROVED | REJECTED
```

Credit restoration/deduction and booking restriction are calculated from the
locked, current user record. A booking may produce at most one no-show penalty.

### Trip

The exact handling of `DELAYED` must be confirmed because the current enum mixes
lifecycle and disruption state. Until the source-of-truth decision is recorded,
the minimum enforceable lifecycle is:

```text
NOT_STARTED -> BOARDING -> DEPARTED -> ARRIVED
NOT_STARTED | BOARDING -> CANCELLED
```

`DELAYED` may not be allowed to bypass or reverse terminal states. The final
transition matrix belongs in `features/trips/domain/trip-status.ts` and its unit
tests, not in UI button conditions.

## 9. Database rules

Keep PostgreSQL and evolve it with reviewed migrations. Recommended changes are
subject to the unresolved requirement decisions in the audit.

- Store ordered stops as `RouteStop` rows if segment selection is a real booking
  requirement; otherwise remove segment claims from the UI and documentation.
- Add constraints for positive capacity, score range, valid waitlist fields,
  seat/booking status consistency where practical, and one penalty per booking.
- Add a partial unique index for one active booking per student/trip and, if
  historical seat assignment is retained, one active assignment per seat.
- Add composite indexes matching job and queue reads: trip deadline/status,
  booking trip/status/position, appeal status/created time, notification
  user/read/created time, and device log seat/recorded time.
- Treat soft deletion consistently and exclude deleted fleet records from active
  queries. Historical DTOs may still include them.
- Never edit an applied migration. Add a new migration and a backfill/verification
  step when the model changes.

## 10. Authentication and security

- Proxy performs only optimistic page redirects. Every page data query, Route
  Handler, and use case performs secure authorization again.
- The session payload contains only stable identifiers and minimum authorization
  claims. The live user/session version is checked for protected operations.
- Cookie settings are centralized. Mutating endpoints validate origin in addition
  to `SameSite`, validate content type and size, and use consistent 401/403 rules.
- Login/registration rate limiting must use a deployment-appropriate shared or
  host-provided limiter; a process-local map is not a security boundary.
- Session and QR secrets are separate, validated at startup, and rotatable.
- QR issuance checks booking ownership, confirmed state, trip state, and the
  approved pre-departure time window. Check-in revalidates the live booking,
  seat, trip, actor assignment, and token binding inside the transaction.
- Realtime clients authenticate with a short-lived ticket issued by Next.js.
  Room membership is authorized from ticket claims; knowing a trip UUID is not
  permission to subscribe.
- Add CSP and standard security headers. Do not disable browser zoom.

## 11. Realtime and scheduled jobs

Socket events are typed invalidations, not alternate state:

```ts
type RealtimeEvent =
  | { type: "seat.changed"; tripId: string; occurredAt: string }
  | { type: "trip.changed"; tripId: string; occurredAt: string }
  | { type: "device.changed"; tripId: string; seatId: string; occurredAt: string };
```

Clients receiving an event refetch the authorized monitoring DTO. Events contain
no student PII. The internal emit endpoint accepts bounded JSON, authenticates a
server credential in a header, validates the event schema, and reports non-2xx
responses to the Next.js publisher.

The realtime scheduler may continue to trigger jobs once per minute for the FYP
demo, provided every job is idempotent. Deployment documentation must state that
the scheduler is a long-running process and therefore cannot be assumed to run
inside a request-only/serverless deployment.

## 12. Frontend and state management

- Prefer Server Components for initial session and page data, with small Client
  Components for forms, tabs, QR refresh, charts, and Socket.io.
- Do not add a global state library. Server data is passed as typed initial DTOs;
  feature-local hooks own browser refresh state where needed.
- Do not duplicate current-user requests in the page and navbar. Resolve the user
  once on the server and pass the safe DTO.
- Use `loading.tsx`, route-level `error.tsx`, accessible empty states, and shared
  form/dialog primitives.
- Dialogs require focus trapping, Escape handling, labelled controls, and focus
  restoration. Status must never be communicated by color alone.
- Keep the responsive design and useful visual language, but delete fake controls
  and out-of-scope simulated GPS tracking. Simulated device health remains clearly
  labelled as simulation because it is an explicit requirement.
- PWA installability requires real correctly sized icons and HTTPS. Offline API
  caching remains a stretch goal and must not cache private responses without a
  reviewed privacy and invalidation policy.

## 13. Testing architecture

- **Unit:** pure state transitions, cutoffs, credit math, waitlist order, DTO
  redaction.
- **Integration:** real PostgreSQL transactions and constraints for booking races,
  idempotent no-show processing, cancellation/promotion, check-in, and appeals.
- **Contract:** Zod request/response schemas and realtime event schemas.
- **E2E:** browser-based role workflows using isolated fixtures and cleanup.
- **Architecture:** forbidden import/dependency rules and `server-only` boundaries.

Tests must assert behavior, not source-code substrings. `npm test`,
`npm run test:integration`, and `npm run test:e2e` must be explicit scripts and CI
must run lint, typecheck, unit tests, and a production build. Database tests use a
dedicated PostgreSQL database and never mutate a developer's normal database.

## 14. Architecture guardrails for future changes

Before merging a feature change:

1. Identify the owning feature and state transition.
2. Update its contract and domain/use-case tests first.
3. Keep the Route Handler and page as adapters.
4. Prove authorization at the resource, not just the role.
5. Prove retry/concurrency behavior for multi-row mutations.
6. Return a minimal DTO and publish only non-sensitive invalidations.
7. Remove the superseded implementation in the same phase; do not leave parallel
   sources of truth.

Exceptions to these rules require a short architecture decision in this file or
an adjacent ADR with the concrete FYP benefit and removal/maintenance cost.
