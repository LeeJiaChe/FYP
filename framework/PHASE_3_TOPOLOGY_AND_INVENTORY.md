# Phase 3 — Directional Topology and Per-Trip Inventory

Status: **Implemented on `architecture-v2`; Phase 4 not started**

Date: 2026-08-15

## Scope delivered

Phase 3 makes normalized directional topology and immutable per-Trip inventory
the Architecture v2 source of truth:

- `Stop` stores a stable code, display name, coordinates, retirement timestamp,
  and audit timestamps.
- `RouteStop` orders distinct Stops within one directional Route and stores the
  estimated travel duration to the next Stop.
- `Bus` owns independently configurable seated and standing capacities.
- `Trip` snapshots both capacities.
- `TripStop` snapshots the Stop identity shown to users, coordinates, position,
  planned timing, and boarding deadline.
- `TripSegment` records each adjacent interval in a Trip snapshot.
- `TripSeat` records immutable seat numbers `1..seatedCapacity` and has no
  whole-Trip availability status.

No `ReservedSeatSegment`, journey-aware `Booking`, `WaitlistEntry`, walk-in,
standing-claim, or location-sample model is included. Those remain later phases.

## Final schema decisions

| Model | Decision and invariant |
|---|---|
| `Stop` | Native PostgreSQL UUID primary key; unique stable `code`; trimmed non-empty `name`; decimal latitude/longitude; `deletedAt` retirement rather than destructive deletion. SQL checks constrain latitude to `[-90, 90]` and longitude to `[-180, 180]`. |
| `Route` | One direction only. The JSON `stops` column is removed. `RouteStop` is the only topology source. Reverse direction is a separate Route. |
| `RouteStop` | Zero-based `position`; unique `(routeId, position)` and `(routeId, stopId)`; positive `travelDurationToNextMinutes` for every non-final Stop and `null` for the final Stop. The 2–5 count and terminal-duration rule are aggregate domain validation because they cannot be expressed honestly as a row-local check. |
| `Bus` | Legacy `capacity` is migrated to `seatedCapacity`; `standingCapacity` is added. SQL checks enforce seated `> 0` and standing `>= 0`. |
| `Trip` | Copies the Bus capacities when scheduled. It retains origin/final compatibility fields while per-stop timing becomes authoritative. SQL checks capacity and final arrival after origin departure. |
| `TripStop` | Keeps the source `stopId` for identity and snapshots code, name, coordinates, order, planned arrival/departure, and boarding deadline. Optional actual arrival/departure/passed timestamps are future-compatible operational evidence. |
| `TripSegment` | For `N` TripStops, exactly `N-1` rows are generated in positions `0..N-2`. Composite foreign keys ensure both endpoint TripStops belong to the same Trip. |
| `TripSeat` | Exactly `seatedCapacity` rows numbered `1..N`; unique `(tripId, seatNumber)`; no mutable availability field. Phase 4 allocation will use segment claims. |

Routes support two through five distinct Stops. Circular routes, repeated Stops,
reverse inference, and transfers are not implemented.

## Timing and snapshot semantics

The administrator enters one origin departure. The scheduling policy accumulates
each RouteStop's travel duration to derive all later `TripStop` times. Phase 3
uses zero dwell time, so planned arrival equals planned departure at intermediate
Stops. A TripStop boarding deadline is its planned departure plus the centralized
normal boarding-close grace period. Approved operational delay handling can
extend the effective window later without rewriting the planned snapshot.

Trip topology is historical data. Later changes to Bus capacity, RouteStop order
or travel duration, or Stop name/coordinates do not update an existing Trip,
TripStop, TripSegment, or TripSeat. Optional actual progress timestamps are the
only mutable operational fields introduced on TripStop.

Trip creation performs validation and writes the Trip, TripStops, TripSegments,
TripSeats, and temporary legacy Seat mirrors in one Prisma transaction. Route,
Bus, and optional Driver schedule keys use PostgreSQL transaction advisory locks.
The use case requires an active Route whose Stops are active, an active Bus,
an optional `DRIVER` actor, a future departure, valid topology/capacities, and no
simple interval overlap for the same Bus or Driver.

## Migration strategy

The historical migration remains untouched. Forward migration
`20260815120000_phase_3_topology_and_inventory` contains the schema changes and
reviewed PostgreSQL checks/foreign keys.

There is deliberately no lossy data conversion. The migration raises a clear
error when legacy Route, Trip, Seat, or Booking rows exist. The owner approved
reset/reseed because legacy Bookings do not contain truthful boarding/drop-off
data. Development and test environments must therefore run a Prisma reset and
the deterministic seed. Production data preservation is not claimed.

The seed creates five reusable demo Stops, two directional route pairs, buses
with different seated/standing capacities, and multiple scheduled Trips. Names
are explicitly prefixed `Demo:` and make no claim to be official TAR UMT routes.

## Legacy compatibility boundary

| Legacy concept | Phase 3 classification | Exact boundary/removal |
|---|---|---|
| `Route.stops` JSON | **REMOVED** | Replaced now by `Stop`/`RouteStop`; route APIs, admin forms, trip creation, and seed use normalized rows. |
| `Bus.capacity` | **MIGRATED** | Renamed to `seatedCapacity`; `standingCapacity` added; Trip snapshots are authoritative for scheduled capacity. |
| Mutable Bus capacity used for Trip totals | **MIGRATED** | Trip APIs and analytics read `Trip.seatedCapacity`; Bus edits do not alter history. |
| `Seat` and `Seat.status` | **TEMPORARY LEGACY** | Each newly scheduled `TripSeat` gets one linked legacy Seat solely to keep Phase 4 booking and older driver/student views buildable. `TripSeat` is authoritative inventory. Phase 4 must stop using Seat for booking availability; Phase 8 removes the sensor-dependent Seat/status schema after its remaining consumers are removed. |
| Origin `Trip.boardingDeadline` | **TEMPORARY LEGACY** | Mirrors the first TripStop deadline for existing screens/jobs. Passenger-specific rules must use `TripStop.boardingDeadline` when Phase 4/6 migrate them. |
| Legacy `Booking`/waitlist fields | **TEMPORARY LEGACY, UNCHANGED** | No journey truth was invented. Phase 4 replaces the reserved/waitlist slice after the approved reset. |
| `TripStatus.DELAYED` and device schema | **TEMPORARY LEGACY, UNCHANGED** | Lifecycle migration is Phase 5; device-only removal is Phase 8. |

The compatibility Seat is not a second Architecture v2 availability source.
No new code may use its status to answer segment availability.

## Constraints and query-aligned indexes

The migration adds checks for Stop coordinates/text, Route names, non-negative
positions, positive non-terminal travel durations, Bus/Trip capacities, Trip
arrival ordering, TripStop planned-time ordering, distinct segment endpoints,
and positive TripSeat numbers. Uniqueness protects RouteStop order/identity,
TripStop order/source identity, TripSegment order/identity, and TripSeat identity.

Composite TripStop identity enables same-Trip segment endpoint foreign keys.
Indexes support upcoming Trips by Route/time, Driver schedules, TripStops by
source Stop/planned time, and every ordered child collection through its unique
`(parentId, position-or-number)` index. No speculative search infrastructure or
PostGIS dependency was added.

## Module boundary

- `src/features/fleet` owns Stop/Route contracts, pure topology validation,
  Prisma persistence, admin use cases, and its server facade.
- `src/features/trips` owns deterministic snapshot construction, transactional
  scheduling/listing, persistence, and its server facade.
- Route Handlers are transport adapters: validate with Zod, resolve the actor,
  invoke one facade operation, and use the shared HTTP/error mapping.
- Only feature infrastructure imports the shared Prisma boundary. Domain,
  application, UI, and client modules cannot import Prisma.

The implementation intentionally creates only folders with concrete consumers;
there are no placeholder layers or repository abstractions.

## Test strategy and evidence

Pure unit tests cover topology constraints and deterministic snapshot timing,
segment, and seat generation. Architecture tests scan the real feature modules
and prohibit Prisma in UI/domain/application code, business transitions in Route
Handlers, feature-internal deep imports, and server code entering Client
Components.

The fail-closed integration runner verifies `TEST_DATABASE_URL`, rejects the
normal development database, resets only an explicitly confirmed `_test`
PostgreSQL database, applies forward migrations, reports migration status, then
runs the suite. Phase 3 integration cases cover:

- invalid Stop coordinates and Bus capacities rejected by PostgreSQL;
- RouteStop position and Stop uniqueness;
- capacity snapshots and exact TripStop/TripSegment/TripSeat generation;
- `N-1` segments and seats `1..seatedCapacity`;
- independence from later Bus, RouteStop, and Stop edits; and
- concurrent duplicate TripSeat identity rejected by the database.

Observed before the Phase 3 candidate push:

| Check | Status | Evidence |
|---|---|---|
| `npm run lint` | **PASS** | Zero-warning Architecture v2 scope, including new feature, integration, and script files. |
| `npm run typecheck` | **PASS** | `next typegen` and strict `tsc` complete in a writable diagnostic copy; the canonical mount remains unable to write `.next` artifacts. |
| `npm run test:unit` | **PASS** | All 11 files pass, including retained Phase 1 specifications and new fleet/trip policies. |
| `npm run test:architecture` | **PASS** | Real feature tree and new client/application boundary fixture pass. |
| `npx prisma validate` | **PASS** | PostgreSQL Prisma schema is valid; the existing package-level Prisma configuration deprecation remains informational. |
| `npm run test:integration` locally | **BLOCKED BY ENVIRONMENT** | The fail-closed runner accepts only the confirmed `_test` target, then PostgreSQL is unreachable because this managed sandbox prohibits server sockets. No database pass is claimed locally. |
| `npm run build` | **BLOCKED BY ENVIRONMENT** | Default Turbopack fails only when its CSS worker tries to bind a prohibited port. The documented `next build --webpack` fallback **PASSES**, including compilation, TypeScript, and all 33 pages. |
| `git diff --check` | **PASS** | No whitespace defects. |
| PostgreSQL 16 CI | **PENDING AT CANDIDATE COMMIT** | The workflow provisions PostgreSQL 16 and runs the guarded migration/integration command on pushes to `architecture-v2`. Its observed result belongs in the final handoff. |

The local socket limitation must not be reported as a database test pass. Phase
3 is fully verified only when the pushed PostgreSQL 16 job succeeds.

## Phase boundary and next task

Phase 3 stops here. Phase 4 should implement reserved passenger journeys and the
journey-aware waitlist: add boarding/drop-off TripStop references,
`ReservedSeatSegment`, database-enforced overlap protection, adjacent segment
reuse, oldest-compatible-first promotion, and the student
`From -> To -> Date -> Departure -> Seat` flow. It must remove Booking's reliance
on the compatibility Seat status but must not begin walk-in admission or GPS.
