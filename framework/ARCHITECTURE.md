# Architecture v2

Status: **Approved target; Phase 4 reserved journeys implemented incrementally**

Decision date: 2026-08-14

Phase 0 owner amendments and pre-Phase-1 operating decisions aligned: 2026-08-14

Companion audit: [`ARCHITECTURE_AUDIT_2026-08-14.md`](./ARCHITECTURE_AUDIT_2026-08-14.md)

Phase 2 evidence: [`PHASE_2_SHARED_FOUNDATION.md`](./PHASE_2_SHARED_FOUNDATION.md)

Phase 3 evidence: [`PHASE_3_TOPOLOGY_AND_INVENTORY.md`](./PHASE_3_TOPOLOGY_AND_INVENTORY.md)

Phase 4 evidence: [`PHASE_4_RESERVED_JOURNEYS.md`](./PHASE_4_RESERVED_JOURNEYS.md)

This document is the normative architecture proposal for the TAR UMT Campus
Shuttle Management System. `APP_SPECIFICATION.md` remains the product source of
truth. Where that specification is ambiguous or internally inconsistent, the
recorded decisions in the companion audit apply; new ambiguity must be resolved
before silently inventing behavior.

## 1. Architecture decision

Use a **feature-oriented modular monolith** in the Next.js application, plus the
already-required standalone Socket.io process.

The system therefore has three runtime units, not a fleet of services:

1. The responsive browser application.
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
| Browser | Responsive rendering, interaction state, forms, pending UI, map display, Socket.io subscription, refetch after events | Authorization, capacity decisions, credit calculations, state-transition decisions, secrets |
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
| `fleet` | Buses with seated/standing capacity, Stops, directional Routes, ordered RouteStops, soft-delete/retirement policy |
| `trips` | Trip scheduling, TripStop/TripSegment snapshots, driver assignment, lifecycle/progress, per-trip seat inventory |
| `bookings` | Reserved seat journeys, segment allocations, journey-aware waitlist, cancellation/promotion, booking history |
| `walk-ins` | Non-guaranteed intent/pass, boarding-time standing admission, segment claims, walk-in journey history |
| `boarding` | Reserved/Walk-in/Exit QR verification and authorized manual fallbacks; orchestrates booking, walk-in, and trip facades |
| `penalties` | No-show penalty, credit score, booking restriction, appeals |
| `notifications` | In-app notification creation, listing, read state, departure reminders |
| `monitoring` | Authorized journey-aware seated/standing occupancy and operational manifest DTOs |
| `location` | Source-neutral telemetry ingestion, latest/history queries, Trip progress evidence, simulator adapter contract |
| `analytics` | Historical, read-only reserved/walk-in demand, utilization, no-show, and rule-based recommendations |
| `jobs` | Idempotent entry points for no-shows, reminders, waitlist evaluation, and automatic alighting; orchestration only |

`bookings` and `walk-ins` remain separate because a reserved Booking guarantees a
seat while a WalkInIntent guarantees nothing. `boarding` is a driver workflow
with different authorization and timing rules; it coordinates their explicit
server facades without merging their invariants. `location` accepts the same
contract from the FYP simulator and a possible future GPS adapter. `jobs` is not
a business domain; it invokes use cases owned by the relevant features.

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
├── playwright.config.ts                # add with migrated browser E2E flows
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
├── public/                           # ordinary website assets only
├── realtime/
│   ├── server.ts                     # composition root only
│   ├── config.ts
│   ├── authenticate-socket.ts
│   ├── emit-handler.ts
│   ├── rooms.ts
│   ├── scheduler.ts
│   └── location-simulator.ts         # FYP LocationSource adapter
├── src/
│   ├── proxy.ts                      # optimistic page redirects only
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
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
│   │       │   ├── stops/route.ts
│   │       │   ├── stops/[id]/route.ts
│   │       │   ├── routes/route.ts
│   │       │   ├── routes/[id]/route.ts
│   │       │   ├── drivers/route.ts
│   │       │   └── drivers/[id]/route.ts
│   │       ├── journeys/search/route.ts
│   │       ├── trips/route.ts
│   │       ├── trips/[id]/route.ts
│   │       ├── trips/[id]/location/route.ts
│   │       ├── trips/[id]/manifest/route.ts
│   │       ├── bookings/route.ts
│   │       ├── bookings/mine/route.ts
│   │       ├── bookings/availability/route.ts
│   │       ├── bookings/[id]/cancel/route.ts
│   │       ├── bookings/[id]/qr-token/route.ts
│   │       ├── waitlist/route.ts
│   │       ├── walk-ins/route.ts
│   │       ├── walk-ins/mine/route.ts
│   │       ├── walk-ins/[id]/qr-token/route.ts
│   │       ├── boarding/reserved/scan/route.ts
│   │       ├── boarding/walk-in/scan/route.ts
│   │       ├── boarding/manual/route.ts
│   │       ├── alighting/scan/route.ts
│   │       ├── alighting/manual/route.ts
│   │       ├── penalties/mine/route.ts
│   │       ├── penalties/[id]/appeal/route.ts
│   │       ├── appeals/route.ts
│   │       ├── appeals/[id]/route.ts
│   │       ├── notifications/mine/route.ts
│   │       ├── notifications/[id]/read/route.ts
│   │       ├── analytics/utilization/route.ts
│   │       ├── analytics/no-show-rate/route.ts
│   │       ├── realtime/token/route.ts
│   │       └── internal/
│   │           ├── location/ingest/route.ts
│   │           └── jobs/
│   │               ├── no-shows/route.ts
│   │               ├── reminders/route.ts
│   │               ├── waitlist/route.ts
│   │               └── auto-alighting/route.ts
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
│   │   ├── walk-ins/                 # same internal shape
│   │   ├── boarding/                 # same internal shape
│   │   ├── penalties/                # same internal shape
│   │   ├── notifications/            # same internal shape
│   │   ├── monitoring/               # same internal shape
│   │   ├── location/                 # same internal shape
│   │   ├── analytics/                # same internal shape
│   │   └── jobs/
│   │       ├── application/
│   │       └── server.ts
│   └── shared/
│       ├── config/
│       │   ├── env.server.ts
│       │   ├── server-environment.ts
│       │   └── policies.ts
│       ├── application/
│       │   └── application-error.ts
│       ├── db/
│       │   └── prisma.server.ts
│       ├── http/
│       │   ├── error-response.ts
│       │   ├── handle-route.server.ts
│       │   └── origin-check.ts
│       ├── realtime/
│       │   ├── event-contracts.ts
│       │   └── publisher.server.ts
│       ├── time/
│       │   └── clock.ts
│       ├── validation/
│       │   └── student-identity.ts
│       ├── ui/
│       │   ├── modal.tsx
│       │   ├── confirm-dialog.tsx
│       │   ├── form-field.tsx
│       │   ├── empty-state.tsx
│       │   └── status-badge.tsx
│       └── types/
│           └── uuid.ts
└── tests/
    ├── unit/
    │   ├── bookings/
    │   ├── trips/
    │   └── penalties/
    ├── integration/
    │   ├── auth/
    │   ├── booking-lifecycle/
    │   ├── boarding/
    │   ├── walk-in-capacity/
    │   ├── location/
    │   ├── no-show/
    │   └── appeals/
    ├── contract/
    │   ├── api/
    │   └── realtime/
    ├── e2e/
    │   ├── student-reserved-journey.spec.ts
    │   ├── student-walk-in-request.spec.ts
    │   ├── driver-boarding-alighting.spec.ts
    │   ├── student-live-location.spec.ts
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
│   ├── journey-segments.ts
│   ├── seat-availability.ts
│   ├── cancellation-policy.ts
│   └── waitlist-policy.ts
├── application/
│   ├── find-journey-availability.ts
│   ├── create-booking.ts
│   ├── cancel-booking.ts
│   ├── join-waitlist.ts
│   ├── promote-waitlist.ts
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

- Reserved booking derives the complete ordered TripSegment set, creates the
  Booking and all `ReservedSeatSegment` rows in one transaction, and relies on
  unique `(tripSeatId, tripSegmentId)` claims to reject overlap. Promotion also
  locks the Trip so queue evaluation is deterministic.
- Walk-in admission locks every requested `TripSegment` row in ascending sequence
  before counting `StandingSegmentClaim` rows. It creates the WalkInJourney and
  all claims only when every segment is below the Trip's standing-capacity
  snapshot. This lock order is mandatory for every admission path.
- Cancellation and no-show re-read the live journey and release reserved segment
  claims in the same transaction before any approved waitlist evaluation.
- Reserved boarding claims no new capacity; it revalidates and transitions the
  already allocated Booking. Walk-in boarding is the capacity-claiming operation.
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
Booking:       CONFIRMED (checkedInAt null -> non-null) -> COMPLETED
               CONFIRMED -> CANCELLED | NO_SHOW
Waitlist:      WAITING -> PROMOTED | CANCELLED | EXPIRED
WalkInIntent:  PENDING -> BOARDED | REJECTED_FULL | CANCELLED | EXPIRED
WalkInJourney: BOARDED -> COMPLETED
```

An unsuccessful full-capacity Walk-in scan does not create a WalkInJourney or
claims and marks that attempt `REJECTED_FULL`; a later attempt requires a new
intent. Reserved and standing capacity use planned TripSegments; actual alighting
is evidence and never rewrites the planned allocation.

### Penalty and appeal

```text
Penalty: ACTIVE -> APPEALED -> OVERTURNED | UPHELD
Appeal:  PENDING -> APPROVED | REJECTED
```

Credit restoration/deduction and booking restriction are calculated from the
locked, current user record. A booking may produce at most one no-show penalty.

### Trip

The lifecycle is:

```text
NOT_STARTED -> BOARDING -> DEPARTED -> ARRIVED
NOT_STARTED | BOARDING | DEPARTED -> CANCELLED
```

`ARRIVED` and `CANCELLED` are terminal and cannot be reversed. Delay is separate
disruption metadata (`delayMinutes`, `delayReason`, and audit timestamps), never a
lifecycle value. Admin emergency cancellation after departure must require a
reason and append a minimal `TripStatusHistory` record when that feature is
implemented. The transition matrix belongs in
`features/trips/domain/trip-status.ts` and its unit tests, not UI button
conditions.

## 9. Architecture v2 data model proposal

Keep PostgreSQL and evolve it with forward, reviewed migrations. Do not edit the
applied initial migration. Names below are proposed physical names; Phase 1 tests
must protect current behavior before Phase 2/3 migrations are written.

### Topology and journey model

```text
Stop <- RouteStop -> Route -> Trip -> TripStop -> TripSegment
                              |
                              +-> TripSeat -> ReservedSeatSegment <- Booking
                              |                                      ^
                              |                                      |
                              |                                WaitlistEntry
                              |
                              +-> WalkInIntent -> WalkInJourney -> StandingSegmentClaim
                              |
                              +-> TripLocationSample
```

| Proposed model | Essential fields/invariant | Purpose |
|---|---|---|
| `Stop` | code/name, latitude/longitude, active/deleted state | Reusable physical boarding/alighting location. |
| `Route` | name, active/deleted state | One directional route only. Reverse direction is another row. |
| `RouteStop` | route, stop, position, estimated duration to next stop; unique route+position and route+stop | Ordered two-to-five-stop template; repeated/circular stops prohibited; supplies schedule offsets. |
| `Trip` | route/bus/driver, lifecycle, delay metadata, origin/final times, seated/standing capacity snapshots | One execution whose history is not altered by later Bus edits. |
| `TripStatusHistory` | trip, from/to status, actor, reason, occurredAt | Minimal append-only evidence for audited exceptional transitions, including post-departure emergency cancellation. |
| `TripStop` | trip, stop snapshot, position, planned times, boarding deadline, optional actual/passed times | Immutable schedule/progress reference for passenger journeys. |
| `TripSegment` | trip, sequence, adjacent from/to TripStops | Shared unit for reserved overlap and standing-capacity checks. |
| `TripSeat` | trip, seat number; unique together | Physical per-trip seat inventory without a misleading global status. |
| `Booking` | student, trip, TripSeat, boarding/drop-off TripStops, boarding/alighting fields/status | Guaranteed reserved journey and its history. |
| `ReservedSeatSegment` | booking, TripSeat, TripSegment; unique TripSeat+TripSegment | Active segment claims; guarantees that one seat cannot overlap. |
| `WaitlistEntry` | student, trip, boarding/drop-off TripStops, order/status, promoted Booking | Non-guaranteed journey request kept separate from Booking. |
| `WalkInIntent` | student, trip, boarding/drop-off TripStops, pass issue/expiry/status | Non-capacity-bearing Walk-in Pass backing record. |
| `WalkInJourney` | unique intent, student/trip/journey, boarded/alighted fields/status | Created only on successful first-come boarding admission. |
| `StandingSegmentClaim` | walk-in journey, TripSegment; unique journey+segment | Auditable standing occupancy per planned segment. |
| `TripLocationSample` | trip, coordinates, timestamp, source, optional accuracy/speed/heading | Durable source-neutral simulator/GPS telemetry. |

RouteStop data is snapshotted because an administrator may edit a Route after a
Trip is scheduled. Booking and walk-in records therefore reference TripStops.
Each TripStop has planned timing so search, QR windows, and no-show deadlines work
for passengers boarding at intermediate stops. Scheduling derives these times
from the Trip origin departure plus snapshotted RouteStop travel-duration offsets;
admins do not manually enter each stop time.

### Concurrency and constraint strategy

- Creating a reserved Booking inserts one ReservedSeatSegment for every traversed
  segment. PostgreSQL uniqueness on `(tripSeatId, tripSegmentId)` is the final
  overlap guard; all inserts roll back if any segment conflicts.
- Cancelling/no-showing a non-boarded reserved journey removes its active segment
  rows in the same transaction. The Booking endpoints preserve historical From/
  To data. A boarded journey keeps its planned claims through completion.
- Walk-in QR issuance inserts no capacity row. Admission locks requested
  TripSegments in increasing order, counts StandingSegmentClaims, validates every
  count against `Trip.standingCapacity`, then inserts the journey and claims.
- Waitlist promotion reads active entries by immutable queue time/order and selects
  the oldest entry whose entire journey currently fits. Incompatible earlier
  entries may be skipped without changing their priority.
- Add database checks for ordered positions, positive seated capacity,
  non-negative standing capacity, valid credit range, and one Penalty per Booking.
  Same-Trip and boarding-before-drop-off rules are also enforced in the owning
  use cases because cross-table ordering checks are not simple Prisma constraints.
- Add indexes for route-stop matching, TripStop timing/deadlines, reserved
  segment conflicts, waitlist trip/status/order, standing claims by segment,
  location trip/time, appeal status/time, and notification user/read/time.
- Treat soft deletion consistently. Historical TripStop snapshots and journeys
  remain readable even after fleet templates are retired.

### Current Prisma disposition

| Current model/field | Decision | Architecture v2 treatment |
|---|---|---|
| `User` | KEEP + MODIFY | Preserve identity/credit/session fields. Booking restriction is derived from constrained `creditScore`; do not persist a redundant boolean. |
| `Bus` | MODIFY | Rename `capacity` to `seatedCapacity`; add configurable `standingCapacity`; retain status and soft deletion. |
| `Route` | MODIFY | Keep identity/name/deletion; replace JSON `stops` with `Stop` + ordered `RouteStop`. |
| `Trip` | MODIFY | Keep schedule/bus/route/driver/lifecycle; add capacity snapshots, TripStops/TripSegments, and progress evidence; replace one origin-only boarding deadline with per-TripStop deadlines. |
| `Seat` | **DROPPED IN PHASE 8** | Replaced by `TripSeat`; availability comes from segment claims. |
| `Booking` | MODIFY (breaking) | Reserved journeys only; persist boarding/drop-off TripStops, allow the same TripSeat on non-overlapping journeys, remove waitlist fields, and separate boarded/alighted state. |
| `Penalty` | KEEP + MODIFY | One unique reserved-no-show consequence per Booking, recording actual points deducted for exact restoration. |
| `PenaltyAppeal` | KEEP + MODIFY | One appeal per Penalty; transactional, lock-safe review with minimal privacy-bounded projections. |
| `Notification` | KEEP + MODIFY | Preserve in-app notifications; nullable deduplication keys protect retry-sensitive penalty/appeal effects. |
| `DeviceStatusLog` | **DROPPED IN PHASE 8** | Seat-device monitoring is removed from product scope. |
| `SeatStatus` | **DROPPED IN PHASE 8** | A whole-trip scalar cannot express segment-aware availability. |
| `BookingStatus` | REPLACE values | Separate reserved Booking, WaitlistEntry, WalkInIntent, and WalkInJourney lifecycles. |
| `CheckInMethod` | MODIFY | Generalize to an explicit boarding/alighting method without merging reserved and walk-in records. |
| `DeviceSignal` | **DROPPED IN PHASE 8** | No target consumer remains. |
| `Stop`, `RouteStop`, `TripStop`, `TripSegment`, `TripSeat` | NEW | Directional topology, immutable trip snapshot, and per-trip inventory. |
| `ReservedSeatSegment`, `WaitlistEntry` | NEW | Journey-aware guaranteed allocation and non-guaranteed queue. |
| `WalkInIntent`, `WalkInJourney`, `StandingSegmentClaim` | NEW | Non-guaranteed pass separated from concurrency-safe admission. |
| `TripLocationSample` | **IMPLEMENTED IN PHASE 8** | Simulator-first, replaceable GPS telemetry history/latest state. |
| `TripStatusHistory` | NEW | Minimal append-only audit evidence for exceptional Trip lifecycle changes. |

No schema change was performed in Phase 0, Phase 1, or Phase 2. Phase 3 implements
topology/inventory, Phase 4 implements reserved Booking/ReservedSeatSegment/
WaitlistEntry, and Phase 5 implements WalkInIntent/WalkInJourney/
StandingSegmentClaim plus boarding, alighting, and Trip progress evidence through
forward PostgreSQL migrations. Phase 6 implements reserved no-show, constrained
credit, derived restriction, Penalty/PenaltyAppeal concurrency, and retry-safe
reconciliation. Phase 7 completes authoritative fleet/driver administration,
serialized scheduling and safe rescheduling, immutable snapshot operations, and
one Trip cancellation coordinator used by admin, assigned-driver, and Bus-status
entry points. No Phase 7 schema migration is required. TripLocationSample and later cleanup rows remain target decisions
until their phases.

## 10. Authentication and security

- Proxy performs only optimistic page redirects. Every page data query, Route
  Handler, and use case performs secure authorization again.
- The session payload contains only stable identifiers and minimum authorization
  claims. The live user/session version is checked for protected operations.
- Cookie settings are centralized. Mutating endpoints validate origin in addition
  to `SameSite`, validate content type and size, and use consistent 401/403 rules.
- Browser mutations (`POST`, `PUT`, `PATCH`, and `DELETE`) require an `Origin`
  matching the public request origin. Behind a normal reverse proxy, public origin
  is derived from sanitized `X-Forwarded-Host`/`X-Forwarded-Proto`, falling back to
  `Host` and the request URL. Deployments must overwrite untrusted forwarded
  headers. Existing machine-only cron endpoints are exempt from browser-origin
  validation because they authenticate a separate service secret.
- Login/registration rate limiting must use a deployment-appropriate shared or
  host-provided limiter; a process-local map is not a security boundary.
- Session and QR secrets are separate, validated at startup, and rotatable.
- QR tokens have an explicit purpose/type (`RESERVED_BOARDING`,
  `WALK_IN_BOARDING`, or `ALIGHTING`) and separate backing records. Issuance
  checks ownership, journey, Trip progress, and the approved window relative to
  the passenger's boarding TripStop. Scans revalidate actor assignment, current
  Trip/stop, ordered journey, duplicate state, and reserved allocation or
  standing capacity inside the owning transaction.
- Student identity normalization is server-owned: trim/lowercase email, accept
  only `@student.tarc.edu.my` for students without inventing a stricter local-part
  regex, and trim/uppercase student ID before uniqueness checks.
- Location ingestion authenticates a source credential independent of user
  sessions and rejects invalid coordinates, stale/future timestamps, inactive
  Trips, and oversized payloads.
- Realtime clients authenticate with a short-lived socket token issued by Next.js.
  Room membership is authorized from token claims; knowing a trip UUID is not
  permission to subscribe.
- Apply a deliberately limited CSP (`frame-ancestors`, `object-src`, `base-uri`,
  and `form-action`) plus clickjacking fallback, `nosniff`, strict referrer, and
  least-privilege browser permissions. A strict `script-src`/`style-src` policy is
  deferred until a tested nonce/hash design can support Next.js rendering without
  brittle `unsafe-inline`. Do not disable browser zoom.

## 11. Realtime and scheduled jobs

Socket events are typed invalidations, not alternate state:

```ts
type RealtimeEvent =
  | { type: "occupancy.changed"; tripId: string; occurredAt: string }
  | { type: "trip.changed"; tripId: string; occurredAt: string }
  | { type: "location.changed"; tripId: string; recordedAt: string };
```

Clients receiving an event refetch the authorized monitoring DTO. Events contain
no student PII. The internal emit endpoint accepts bounded JSON, authenticates a
server credential in a header, validates the event schema, and reports non-2xx
responses to the Next.js publisher.

The realtime scheduler may trigger no-show, reminder, waitlist, and automatic-
alighting entry points, provided every job is idempotent. It does not simulate
seat devices. The GPS simulator is a location-source adapter that submits the
same validated ingestion contract a future real source would use; it does not
write Prisma or publish directly to browsers. Deployment documentation must state
that the scheduler/simulator are long-running processes and cannot be assumed to
run inside a request-only/serverless deployment.
The simulator targets one sample every five seconds and always calls the shared
ingestion boundary. A retry-safe job removes location samples older than seven
days.

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
- The student flow is `From -> To -> Date -> Departure -> Seat`; route segments
  remain an internal capacity concept. Availability and counts are always scoped
  to the selected journey.
- Reserved Pass and Walk-in Pass screens use distinct language and visual state.
  Walk-in must state that it does not guarantee boarding.
- The final scanner uses the browser camera. Paste-token entry is retained, if at
  all, only as an explicitly labelled development/demo fallback.
- Keep the responsive design and useful visual language. Replace schedule-
  interpolated fake tracking with a map consuming source-neutral telemetry and
  label simulator data. Remove seat-sensor/device-health UI and unrelated fake
  controls in their scheduled migration phases.
- Remove the non-functional account deletion and data-export settings in the
  frontend cleanup phase; neither workflow is in FYP scope.
- This is a responsive website, not a PWA. Do not add manifest, installability,
  service-worker, offline-cache, or PWA-icon work.

## 13. Testing architecture

- **Unit:** ordered route matching, journey-segment derivation, state transitions,
  cutoffs, credit math, waitlist policy, pass-purpose validation, and DTO
  redaction.
- **Integration:** real PostgreSQL transactions and constraints for overlapping
  versus adjacent reserved journeys, simultaneous standing scans at the capacity
  boundary, idempotent boarding/alighting/no-show, cancellation/promotion, and
  appeals.
- **Contract:** Zod request/response schemas and realtime event schemas.
- **E2E:** browser-based reserved, waitlist, Walk-in disclaimer/admission,
  boarding/alighting, and simulated-location workflows using isolated fixtures.
- **Architecture:** forbidden import/dependency rules and `server-only` boundaries.

Tests must assert behavior, not source-code substrings. Phase 1 uses Node 20's
built-in test runner with the existing TypeScript loader for unit, integration,
and architecture suites. `npm test`, `npm run test:integration`, and
`npm run test:architecture` are explicit scripts; CI runs lint, typecheck, unit,
architecture, PostgreSQL integration tests, and a production build. Add
`test:e2e` with the browser runner when migrated workflows exist rather than for
script symmetry. Database tests use a dedicated PostgreSQL database and never
mutate a developer's normal database.

## 14. Centralized operating-policy configuration

`src/shared/config/policies.ts` owns these configurable defaults:

| Policy | Default |
|---|---:|
| Booking opens | 7 days before boarding-stop planned departure |
| Reserved cancellation cutoff | 30 minutes before boarding-stop planned departure |
| Boarding opens | 15 minutes before boarding-stop planned departure |
| Normal boarding closes | 5 minutes after boarding-stop planned departure |
| Dynamic QR token lifetime | 60 seconds |
| Initial student credit | 100 |
| No-show penalty | 15 points |
| Booking restriction threshold | credit below 40 |
| GPS simulator interval | 5 seconds |
| Location sample retention | 7 days |

Operational delay metadata may extend the normal boarding-close window through
one documented policy calculation. Domain policies receive the resolved values;
they do not read environment variables, and Route Handlers/UI must not repeat the
numbers.

## 15. Architecture guardrails for future changes

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
