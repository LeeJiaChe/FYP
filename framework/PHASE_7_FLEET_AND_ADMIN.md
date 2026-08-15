# Phase 7 — Fleet, Scheduling, Driver Assignment, and Admin Operations

Status: **Implemented on `architecture-v2`; Phase 8 not started**

Date: 2026-08-15

## Scope and ownership

Phase 7 completes the FYP administration path without introducing enterprise
fleet infrastructure. `fleet` owns Stop, directional Route/RouteStop, and Bus
asset operations. `trips` owns scheduling, immutable Trip snapshots, assignment,
safe rescheduling, delay/progress compatibility, and every Trip cancellation.
`identity` owns only the concrete admin Driver-account operations required for
assignment. Route Handlers authenticate, validate, invoke one server facade, and
map typed errors; they do not contain Prisma transactions or business changes.

The admin demo path now supports creating/editing/deactivating Stops, creating and
editing ordered directional Routes, creating/editing/maintaining/retiring Buses,
creating/editing Driver accounts, scheduling Trips, viewing derived intermediate
times and immutable capacities, rescheduling/reassigning an empty Trip, and
cancelling a Trip explicitly or through future-Bus unavailability.

## Stop, Route, and Bus lifecycle

- Stop code and Bus plate number are trimmed and normalized to uppercase. Stop
  name, coordinates, capacity, topology length, stop identity, terminal duration,
  and per-leg durations are validated before persistence; PostgreSQL retains its
  coordinate/capacity/identity constraints.
- Stops and Routes use `deletedAt`. Normal selectors return only active records.
  Historical `TripStop` snapshot fields remain readable. A Stop referenced by an
  active Route cannot be deactivated until that Route is edited or deactivated,
  preventing a silently invalid active topology.
- A Route has 2–5 unique active Stops. Application code assigns contiguous
  positions `0..N-1`; every non-final duration is a positive integer and the
  final duration is null. Reverse direction remains a separate Route.
- Route edits change only the mutable template. They never rewrite an existing
  TripStop or TripSegment snapshot. Structural changes to an already scheduled
  Trip require cancel-and-recreate.
- Bus `ACTIVE` is schedulable, `MAINTENANCE` is not schedulable, and `RETIRED` is
  terminal and soft-deleted through the retire operation. Maintenance may return
  to active service; retirement cannot be reversed. Capacity edits affect only
  future Trip snapshots and never resize existing TripSeat inventory.

## Scheduling source of truth

`scheduleTrip` remains the only admin scheduling path. It locks stable PostgreSQL
advisory keys for Route, Bus, and optional Driver, verifies active topology and an
`ACTIVE` Bus, server-verifies that an assigned account has role `DRIVER`, applies
the half-open overlap rule, then creates the Trip, TripStops, TripSegments,
TripSeats, and temporary Phase 8 Seat mirrors in one transaction.

The overlap rule is:

```text
existing.departureTime < candidate.estimatedArrivalTime
AND existing.estimatedArrivalTime > candidate.departureTime
```

The same locks and overlap query protect both Bus and Driver assignment. No
optimizer or external lock service is used.

An empty `NOT_STARTED` Trip may change only origin departure and Driver
assignment. A departure change shifts each immutable TripStop's planned time and
boarding deadline by the same offset; it does not rebuild topology or inventory.
Any Booking, WaitlistEntry, WalkInIntent, or WalkInJourney blocks that edit.
Route, Bus, topology, and capacity changes are deliberately unsupported: cancel
and create a replacement Trip instead.

## Authoritative Trip cancellation

`trips.cancelTripInTransaction` is the single durable cancellation coordinator.
The admin API, assigned-Driver progress action, and Bus-unavailability workflow
all converge on it. It locks and re-reads the Trip, verifies the live actor
(`ADMIN`, or the assigned `DRIVER` only where explicitly enabled), requires a
reason, rejects `ARRIVED`, and treats an already-cancelled retry idempotently.

One transaction:

1. releases all active ReservedSeatSegment claims for the Trip;
2. changes active `CONFIRMED` Bookings to `CANCELLED`;
3. changes `WAITING` WaitlistEntries to `CANCELLED` without promotion;
4. changes pending WalkInIntents to `CANCELLED`;
5. appends one TripStatusHistory record;
6. changes the Trip to `CANCELLED`; and
7. creates one durable, deduplicated cancellation notification per affected
   student.

It preserves Booking, waitlist, WalkIn, Trip, inventory, completed journey, and
historical snapshot rows. It creates no no-show Penalty and never consults or
updates legacy Seat.status as capacity truth. When an active Bus becomes
`MAINTENANCE` or is retired, only its future `NOT_STARTED` Trips are sent through
this coordinator. `BOARDING`/`DEPARTED` service requires an explicit operational
emergency action.

Realtime Trip invalidation is published only after a direct cancellation or
schedule edit commits and is best effort. Durable notifications and database
state remain authoritative.

## Projections and privacy

Admin Trip listing now reports authoritative reserved, boarded-reserved,
no-show, boarded-walk-in, and waiting counts. It does not derive occupancy from
Seat.status. Driver/Admin operational manifests continue to share the Phase 5
privacy-limited projection: name, limited student ID, journey, reserved seat,
boarding, and expected alighting only.

Driver account DTOs select only ID, name, normalized email, role, and createdAt.
`passwordHash`, session data, credit, penalties, and unrelated student data are
never returned. Passwords are hashed with bcrypt before persistence. No HR,
password-reset, or invented account-active subsystem was added.

## Schema and migration decision

No Phase 7 Prisma migration was necessary. Existing Architecture v2 fields and
constraints already express Stop/Route soft deletion, Bus lifecycle/capacities,
Trip assignment/snapshots, TripStatusHistory, and notification deduplication.
Manufacturing a no-op migration would add no correctness value. Earlier
migrations remain unchanged.

## Verification evidence

Phase 7 adds pure unit coverage for fleet asset transitions, schedulability,
half-open interval overlap, passenger-state detection, and structural edit
eligibility. The PostgreSQL suite covers inactive-stop rejection, topology
validation, snapshot independence, unavailable-Bus and Driver-role checks,
serialized Bus/Driver conflicts, cancellation effects and retry idempotency,
safe rescheduling, structural-edit rejection, terminal Trips, authorization,
privacy, and historical reads after retirement.

GitHub Actions run `31860557091` on PostgreSQL 16 applied the complete forward
migration history and passed all 50 integration tests across 11 suites, including
all seven grouped Phase 7 scenarios above. The same run passed Prisma generation,
Architecture v2 lint, strict typecheck, all 59 unit/specification tests, all 10
dependency-policy tests, and the production Next.js build. Local verification
also passed `npm run verify`, `npx prisma validate`, and `git diff --check`.

The local sandbox cannot bind a PostgreSQL socket/port or the Turbopack helper
port, so local integration/build attempts failed closed for environment reasons;
the successful CI run is the required real PostgreSQL 16 and production-build
evidence. This documentation-only evidence commit changes no executable or
schema content.

## Phase 8 boundary

Phase 7 intentionally retains the legacy Seat/DeviceStatusLog schema, device
health cron/UI, legacy live-monitoring compatibility projection, Socket.io
cleanup, GPS telemetry work, and analytics migration. Those are isolated for
Phase 8. No device-health value is used by new fleet scheduling, passenger
counts, cancellation, or capacity decisions. Phase 8 should implement the
source-neutral GPS ingestion/realtime pipeline, remove seat-device behavior, and
migrate analytics; it must not reopen these fleet invariants.
