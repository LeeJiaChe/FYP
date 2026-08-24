# Phase 8 — GPS Telemetry, Realtime Hardening, Device Removal, and Analytics

Status: **Implemented and verified on `architecture-v2` against PostgreSQL 16**

Date: 2026-08-15

## Scope and ownership

Phase 8 adds durable, source-neutral Trip location telemetry, restricts the
standalone Socket.io service to signed subscriptions and validated invalidation
events, removes the obsolete whole-Trip Seat/device simulation schema, and
migrates live monitoring and analytics to Architecture v2 data. It does not
perform Phase 9 PWA artifact, broad component-composition, or accessibility
cleanup.

`src/features/location` owns telemetry validation, persistence, latest-location
queries, the simulator adapter, and seven-day retention. `src/features/realtime`
owns Trip subscription authorization/signing. `src/features/analytics` owns
bounded, read-only metric queries and formulas. Route Handlers remain transport
adapters and only feature infrastructure imports Prisma.

## Location data model and trust boundary

`TripLocationSample` stores a UUID, Trip foreign key, decimal latitude/longitude,
`recordedAt`, server `receivedAt`, and `LocationSource` (`SIMULATED` or `GPS`).
PostgreSQL CHECK constraints enforce latitude `[-90, 90]` and longitude
`[-180, 180]`; indexes support latest-by-Trip and retention scans.

The trusted `POST /api/location/ingest` boundary accepts a small Zod-validated
body and authenticates `x-service-secret` with the existing dedicated realtime
service secret. Ingestion rereads the Trip, allows only operational `BOARDING`
or `DEPARTED` Trips, rejects invalid/far-future samples, persists first, and then
publishes best-effort `location.changed`. The token/body is never authoritative
for Trip lifecycle and the operation cannot board, progress, or cancel a Trip.

Authenticated browser users read a minimal latest-location DTO containing Trip,
coordinates, recorded time, source, and age. No sample produces the honest state
“No live telemetry received yet”; stale data remains visible with explicit age.
There is no schedule-derived coordinate fallback.

## Simulator and future GPS replacement contract

The standalone process calls `POST /api/location/simulate` approximately every
five seconds. The simulator selects one eligible operational Trip (or a configured
Trip), derives its current segment from actual TripStop progress, generates a
coordinate between the snapshotted Stop coordinates, and calls the same
`ingestLocation` use case used by the trusted physical-GPS endpoint. It never
writes Prisma or emits directly to browsers.

```text
Prototype simulator ─┐
                     ├─> trusted ingestion -> PostgreSQL -> location.changed
Future GPS adapter ──┘                         -> same latest-location DTO/map
```

The UI always labels simulator samples **“Simulated GPS / Prototype”**. Starting
`npm run realtime` starts one process-level simulator writer; browsers never
simulate their own bus.

## Realtime authorization and recovery

An authenticated Next.js endpoint authorizes one Trip and returns a 60-second
HS256 `REALTIME_SUBSCRIPTION` token containing user, role, and Trip scope. Drivers
may request only an assigned Trip; students may subscribe to normal non-cancelled
Trip tracking, and admins may subscribe operationally. Socket.io verifies
signature, issuer, audience, expiry, purpose, role, and room syntax during the
handshake, then joins only the signed room. The old unauthenticated `join-trip`
and `leave-trip` commands no longer exist.

The internal `/emit` endpoint requires `Authorization: Bearer <service secret>`,
limits JSON to 8 KiB, forbids global broadcast, validates the room, and accepts
only:

- `trip.changed`
- `occupancy.changed`
- `location.changed`
- `notification.changed`

Payloads contain only `entityId`, `changedAt`, and an optional bounded `reason`.
Passenger names, manifests, email, credit, penalties, and other PII are invalid.
Initial page load, socket connection/reconnection, a 15-second telemetry fallback,
and manual refresh all refetch PostgreSQL-backed HTTP data. Missing Socket.io
events therefore cannot become state loss.

The realtime process retains the Phase 6 one-minute no-show trigger, runs
location retention daily, and calls the simulator at the centralized five-second
policy. Cron callbacks contain no domain or Prisma logic.

## Seat/device removal and operational occupancy

Forward migration `20260816150000_phase_8_gps_realtime_analytics` adds
`LocationSource`/`TripLocationSample`, then drops `DeviceStatusLog`, `Seat`,
`DeviceSignal`, and `SeatStatus`. It does not edit historical migrations. Trip
scheduling now creates only Trip, TripStops, TripSegments, and TripSeats; seed
and tests create no compatibility Seat mirror.

The device-health endpoint, scheduler trigger, signal generation, DTO field,
SeatGrid warning/label, and admin sensor alert are deleted. Active code no longer
calls `prisma.seat`, `transaction.seat`, or uses a whole-Trip Seat status.

Operational monitoring derives the current/upcoming segment from actual
TripStop arrival/departure/passed evidence. Its seat grid marks TripSeats claimed
on that segment, reports boarded reserved passengers, and reports standing claims
against the Trip standing snapshot. `availableSeats` is scoped to that segment;
student reservation availability remains the Phase 4 complete-journey query.

## Analytics definitions

Analytics default to a bounded trailing 30-day window and reject windows longer
than 366 days. PostgreSQL performs the grouped/count work.

- **Seated utilization** = active/planned `ReservedSeatSegment` rows divided by
  `sum(Trip.seatedCapacity × TripSegment count)` for non-cancelled Trips.
- **Standing utilization** = admitted `StandingSegmentClaim` rows divided by
  `sum(Trip.standingCapacity × TripSegment count)`; zero capacity returns 0%.
- **Ridership** = reserved Bookings with `checkedInAt` plus admitted
  WalkInJourneys.
- **Demand** = Booking + WaitlistEntry + WalkInIntent records in the selected
  Trip/date scope.
- **No-show rate** = `NO_SHOW` reserved Bookings divided by eligible reserved
  outcomes (`NO_SHOW`, `COMPLETED`, or checked-in confirmed operational records).

These definitions deliberately avoid `Booking count / seatedCapacity`, which is
misleading when seats are reused on adjacent segments.

## Verification evidence

- `npm run verify`: **PASS** — zero-warning Architecture v2 lint, strict Next.js
  type generation/typecheck, 23 unit/specification files, and dependency rules.
- Realtime contract tests: **PASS** — whitelist, PII-shaped payload rejection,
  signed room authorization, purpose/signature tampering rejection.
- `npx prisma validate`: **PASS** in the writable diagnostic checkout.
- `npm run build`: **BLOCKED LOCALLY BY ENVIRONMENT** because Turbopack cannot
  bind its CSS worker port in the managed sandbox; `next build --webpack` passes
  all 40 routes and TypeScript checks.
- `npm run test:integration`: **BLOCKED LOCALLY BY ENVIRONMENT** and fails closed
  because no isolated `TEST_DATABASE_URL` is available. PostgreSQL 16 CI is the
  required database/migration/concurrency evidence and is not claimed yet.
- `git diff --check`: **PASS**.

GitHub Actions Verification run
[`31864888065`](https://github.com/jclee-wm25/FYP/actions/runs/31864888065)
completed successfully on PostgreSQL 16 for commit
`aaf3be866b7518b897ee6e360f909ef17d5de36a`:

- clean migration apply/status: **PASS** — all six forward migrations applied,
  including `20260816150000_phase_8_gps_realtime_analytics`;
- PostgreSQL integration: **PASS** — 55 tests across 13 suites;
- unit/specification: **PASS** — 65 tests across 30 suites;
- architecture dependency tests: **PASS** — 10 tests;
- lint, Next.js type generation/typecheck, and production build: **PASS**.

The Phase 8 PostgreSQL suite covers both telemetry sources, latest-by-recorded
time, database coordinate/FK constraints, terminal Trip rejection, simulator use
of the ingestion boundary, seven-day retention, dropped Seat/device tables,
TripSeat-only inventory, segment-weighted seated/standing metrics, authoritative
no-show analytics, and signed non-forgeable Trip subscriptions. The complete
Phase 3–7 suites rerun after the drop migration, proving segment booking,
reserved boarding, and walk-in admission no longer depend on Seat.

## Intentional historical references

Applied historical migrations and the dated audit/Phase 3–7 reports still name
Seat/device models or schedule interpolation to explain the pre-Phase-8 state
and ordered removal plan. Those references are historical evidence, not active
production dependencies. Proposal citation/content correction remains Phase 10.

## Phase 9 boundary

Phase 8 stops here. Phase 9 may remove PWA artifacts, compose large Client
Components, improve loading/error/dialog accessibility, remove out-of-scope
settings, and perform broad responsive UI polish. It must not replace persisted
telemetry with browser interpolation or restore Seat/device simulation.
