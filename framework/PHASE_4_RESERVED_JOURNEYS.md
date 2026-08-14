# Phase 4 — Reserved Journeys and Journey-Aware Waitlist

Status: **Implemented on `architecture-v2`; Phase 5 not started**

Date: 2026-08-15

## Scope delivered

Phase 4 replaces whole-Trip reservation locking with one guaranteed passenger
journey over immutable Phase 3 topology:

- `Booking` references one `TripSeat`, one boarding `TripStop`, and one later
  drop-off `TripStop` on the same Trip.
- `ReservedSeatSegment` stores one active claim for every traversed adjacent
  `TripSegment`.
- `WaitlistEntry` is a separate non-guaranteed journey request and never owns a
  seat or allocation claim.
- availability, direct reservation, cancellation, and promotion have one
  Architecture v2 feature implementation under `src/features/bookings`.
- migrated student endpoints are thin transport adapters and the student flow
  passes TripStop IDs from `From -> To -> Date -> Departure -> Seat`.

Walk-in passes/admission, the final boarding lifecycle/scanner, actual alighting,
GPS telemetry, and penalty migration remain later phases.

## Final Booking schema

An Architecture v2 `Booking` contains `studentId`, `tripId`, `tripSeatId`,
`boardingTripStopId`, `dropOffTripStopId`, status, QR/check-in compatibility
fields, and timestamps. Composite foreign keys guarantee that its TripSeat and
both TripStops belong to its Trip. The application additionally proves boarding
position is before drop-off and derives the exact contiguous segments from the
server-owned Trip snapshot.

Active reserved status in Phase 4 is `CONFIRMED`. `CANCELLED`, `NO_SHOW`, and
the temporary Phase 5 compatibility value `COMPLETED` are historical and do not
participate in the partial unique student/Trip index. A PostgreSQL partial unique
index permits at most one `CONFIRMED` Booking per student and Trip.

`WAITLISTED` and `waitlistPosition` are removed from Booking. Waitlist lifecycle
is `WAITING -> PROMOTED | CANCELLED | EXPIRED`.

## ReservedSeatSegment invariant

Creating a confirmed Booking and every traversed claim is one transaction. The
claim contains Trip, Booking, TripSeat, and TripSegment identity. Composite
foreign keys bind the claim to the Booking's exact seat and bind the segment to
the same Trip. PostgreSQL uniquely enforces:

```text
(tripSeatId, tripSegmentId)
```

Therefore adjacent `A-B` and `B-C` Bookings may reuse one TripSeat, while any
shared segment conflicts. No availability query reads `Seat.status`, total
Booking count, or mutable UI state.

## Concurrency and locking

Every reservation mutation locks the target Trip row with `FOR UPDATE` and then
re-reads student, Trip, stops, topology, claims, and queue state inside the same
transaction. This makes direct booking, release, and promotion deterministic for
one Trip without Redis or a distributed lock. The unique allocation constraint
is still the final race guarantee; a Prisma `P2002` allocation conflict maps to a
typed HTTP 409 rather than a generic 500.

The booking window, credit threshold, and cancellation cutoff receive the
central `ProductPolicy` plus an injectable `Clock`. Timing is relative to the
passenger's boarding TripStop planned departure. Only `NOT_STARTED` Trips are
bookable in Phase 4.

## Waitlist fairness and promotion

A `WaitlistEntry` records the exact From/To TripStops and immutable `queuedAt`.
Joining is allowed only when no one TripSeat spans the complete journey. It does
not create a Booking or any ReservedSeatSegment.

The authoritative promotion loop runs under the same Trip lock. It reads
`WAITING` rows ordered by `queuedAt, id`, evaluates each complete journey against
live claims, and promotes every compatible entry that fits deterministically. An
incompatible older row is skipped without status or timestamp changes and keeps
its priority. Promotion atomically creates the Booking and all claims, marks the
entry `PROMOTED`, links `promotedBookingId`, and creates notifications.

## Cancellation transaction

Student cancellation verifies ownership and `CONFIRMED` state, applies the
central cutoff to the Booking's boarding TripStop, deletes only that Booking's
active claims, retains the Booking/seat/journey history as `CANCELLED`, and runs
the single promotion loop before commit. Durable in-app notification rows commit
with reservation state. The server facade sends only best-effort post-commit
realtime invalidations.

Trip/bus cancellation received only the compatibility changes needed to release
all active reserved claims and cancel pending WaitlistEntries. It does not run
promotion for a cancelled Trip. Final Trip lifecycle ownership remains Phase 5/7.

The legacy no-show entry point now releases claims and invokes the same promotion
implementation before its unchanged legacy penalty work. Full retry-safe no-show
and penalty atomicity remains explicitly Phase 6.

## Legacy compatibility

| Legacy element | Phase 4 treatment | Removal phase |
|---|---|---|
| `Booking.seatId @unique` / `Seat.booking` | Removed. Booking references TripSeat and may share it on adjacent journeys. | Complete now. |
| `Booking.WAITLISTED` / `waitlistPosition` | Removed; replaced by WaitlistEntry. | Complete now. |
| `Seat` / `Seat.status` | Retained only for existing driver/device UI and check-in compatibility. Never read by reserved availability or mutation. | Phase 8 after sensor/device consumers are removed. |
| `Booking.COMPLETED`, `checkedInAt`, `checkInMethod`, QR issue field | Retained for existing boarding/QR compatibility without adding Phase 5 state machinery. | Align in Phase 5. |
| origin `Trip.boardingDeadline` | Retained for legacy Trip/job compatibility. Booking/cancellation uses passenger TripStop timing. | Later trip/job migration. |
| account deletion reservation algorithm | Disabled with HTTP 410 because self-service deletion is out of scope; duplicate promotion code was deleted. | Remove settings surface in Phase 9. |

The current driver/admin seat DTO exposes a non-authoritative coarse
compatibility status plus the journey list. It is not used by the Phase 4 student
availability endpoint.

## Migration and reset behavior

Forward migration `20260815180000_phase_4_reserved_journeys` does not edit either
historical migration. It refuses to run when legacy Booking rows exist because
they have no truthful From/To data. The approved development procedure is reset,
apply all migrations, and reseed. Existing Phase 3 topology with no Bookings can
be migrated in place.

The migration adds reviewed composite foreign keys, allocation uniqueness,
journey stop checks, query-aligned Booking/claim/waitlist indexes, the active
Booking partial unique index, and the active exact-journey waitlist partial
unique index.

## Demo seed

The first three-stop demo Trip contains two seats. Seat 1 is reserved by one
student for `A-B` and another for `B-C`; Seat 2 covers `A-C`. The `A-C` journey is
therefore fully booked and a separate waiting student has a `WAITING`
WaitlistEntry with no allocation. No walk-in data is seeded.

## Verification evidence

Before the candidate push, the zero-warning Architecture v2 lint gate, strict
TypeScript diagnostic, 14 unit/specification files, architecture scan over the
real bookings feature and migrated Route Handlers, Prisma validation, whitespace
check, and the webpack production build passed in the writable local diagnostic
workspace. The default Turbopack build could not bind its worker port in the
managed local sandbox; the equivalent default build was therefore retained as a
CI gate. Local PostgreSQL was unavailable and was not represented as a pass.

GitHub Actions Verification run
[`31835414325`](https://github.com/jclee-wm25/FYP/actions/runs/31835414325)
completed successfully for commit `37144c33165488de8571a46f5512f6d12500aa38`
on PostgreSQL 16. CI applied all three forward migrations to a reset isolated
`fyp_bus_test` database, reported the schema up to date, and passed all 19
integration tests. Lint, typecheck, all 38 unit/specification assertions, all 10
architecture assertions, and the default production build also passed. This is
the required real-database verification; no SQLite or mocked concurrency result
is being substituted for it.

The Phase 4 PostgreSQL suite covers adjacent reuse, overlap rejection,
fragmented availability, a concurrent final-seat race, cross-Trip foreign-key
rejection, precise cancellation release, adjacent reservation preservation,
oldest-compatible promotion, retained skipped priority, active Booking
uniqueness, allocation-free waiting, atomic promotion claims, and unchanged
planned claims after operational state changes.

## Phase boundary

Phase 4 stops after reserved journeys and journey-aware waitlist. Phase 5 should
next implement explicit Reserved/Walk-in/Exit pass contracts, assigned-driver
boarding authorization, the approved Trip lifecycle, concurrency-safe standing
admission, and optional/manual alighting. Phase 5 must not reintroduce whole-Trip
seat status as reservation truth.
