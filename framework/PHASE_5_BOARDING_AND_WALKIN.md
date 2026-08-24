# Phase 5 — Passes, Walk-in Admission, Boarding, Alighting, and Trip Progress

Status: **Implemented on `architecture-v2`; Phase 6 subsequently implemented**

Date: 2026-08-15

## Scope delivered

Phase 5 implements the operational passenger journey without changing the
Phase 4 planned-capacity rules:

- a `WalkInIntent` is a non-guaranteed student request and consumes no capacity;
- successful boarding creates one `WalkInJourney` and one
  `StandingSegmentClaim` for every traversed `TripSegment`;
- Reserved, Walk-in, and Alighting passes are distinct signed contracts;
- QR and authorized manual paths converge on the same boarding/alighting use
  cases;
- assigned drivers progress a Trip through its stops and receive a minimal
  journey manifest; and
- QR, manual, or automatic planned-stop alighting records operational evidence
  without rewriting planned reserved or standing claims.

No no-show penalty migration, GPS telemetry, PWA/device cleanup, or broad UI
redesign is included.

## Persistence and invariants

`WalkInIntent` stores student, Trip, boarding/drop-off TripStops, status, issue
time, expiry, and timestamps. Its concise lifecycle is `PENDING`, `BOARDED`,
`REJECTED_FULL`, `EXPIRED`, or `CANCELLED`. The PostgreSQL partial unique index
permits only one pending exact student/Trip/journey intent. Issuance is allowed
from seven days before the boarding-stop departure through the normal window;
durable arrival at a not-yet-departed stop extends it for operational delay. A
confirmed reserved Booking on the same Trip makes a Walk-in intent redundant.

`WalkInJourney` is created only on admission. It repeats student, Trip, and the
two TripStop identities under a composite foreign key to its unique
`WalkInIntent`; it has no TripSeat. Its status is `BOARDED` or `COMPLETED` and it
stores boarding method plus optional actual alighting evidence.

`StandingSegmentClaim` binds one WalkInJourney to one same-Trip TripSegment. The
database uniquely enforces `(walkInJourneyId, tripSegmentId)`. Composite foreign
keys prevent Trip mixing. Alighting never deletes, shortens, or extends these
planned claims.

`Booking.actualAlightedAt` and `Booking.alightingMethod` add operational evidence
to reserved journeys. A checked-in `CONFIRMED` Booking is boarded and remains
active until alighting; `COMPLETED` means its planned journey operationally
finished. `ReservedSeatSegment` remains unchanged throughout boarding/alighting.

`TripStatusHistory` stores minimal from/to status, actor, reason, and occurrence
time. `TripStatus` is now exactly `NOT_STARTED`, `BOARDING`, `DEPARTED`,
`ARRIVED`, and `CANCELLED`; `DELAYED` is removed. Delay is `delayMinutes` plus
`delayReason` metadata. Terminal states cannot reverse, and post-departure
emergency cancellation requires a reason.

## Standing admission concurrency

Every boarding mutation starts an interactive PostgreSQL transaction and locks
the target Trip row with `FOR UPDATE`. Walk-in admission then derives the
contiguous journey segments from durable TripStops, locks those TripSegment rows
in ascending position order, and re-counts current claims. All requested counts
must be below the Trip's snapshotted `standingCapacity`; only then are the
WalkInJourney, every claim, and `WalkInIntent.BOARDED` written atomically.

The Trip lock serializes all admissions for the service; ordered segment locks
make the narrower capacity coordinator explicit and deadlock-stable. A full
attempt records `REJECTED_FULL` but creates no journey or claim. Intent issue
time is deliberately not queue priority: admission is first-come at the
successful locked transaction. Duplicate scans return the existing journey and
cannot create duplicate claims.

## Pass and QR trust model

The 60-second HS256 tokens use the dedicated QR signing secret and contain only
purpose (`RESERVED_BOARDING`, `WALK_IN_BOARDING`, or `ALIGHTING`), journey kind,
durable record ID, student ID, Trip ID, issued/expiry times, and a token ID. They
are signed, not encrypted, and never replace database authorization. Every scan
rereads the backing record and validates purpose, expiry, student/record/Trip
identity, live lifecycle, current TripStop, driver assignment, and the relevant
planned allocations/capacity.

Student pages refresh the short-lived QR. The driver scanner uses
`getUserMedia` and the browser's native `BarcodeDetector` when available. Token
paste remains visibly labelled as a development/demo fallback. This avoided a
new heavy dependency, but native barcode detection support must be verified on
the browsers used for the final demonstration; a small cross-browser decoder is
the fallback if that target lacks the API.

## Boarding, progress, and alighting

Only a live DRIVER assigned to the Trip may operate it; ADMIN is an explicit
fallback. Client-supplied driver identity is never trusted. QR and manual
reserved boarding both call the same transition, validate the full durable
reserved allocation, and set `checkedInAt/checkInMethod` without changing
ReservedSeatSegments. Walk-in QR/manual boarding likewise converge on the one
locked admission implementation.

Boarding normally opens 15 minutes before and closes five minutes after the
passenger's planned TripStop departure. Actual stop progress is stronger
evidence: an arrived stop that has not departed may extend the window, while
`actualDeparture` or `passedAt` closes it unconditionally.

Driver progress is server-controlled: start boarding at origin, depart the
current stop, arrive at the next stop, and depart until the final stop produces
`ARRIVED`. Progress writes `actualArrival`, `actualDeparture`, and `passedAt`.
Leaving a planned drop-off atomically auto-completes boarded passengers lacking
an explicit exit confirmation using `AUTO_PLANNED_STOP`. Exit QR and driver
manual confirmation use `QR` and `MANUAL` respectively. Forgotten exit scans
therefore do not leave operational journeys permanently open.

Post-commit realtime publication sends minimal invalidations and is best effort;
PostgreSQL remains authoritative.

## Manifest privacy and UI boundary

The assigned-driver manifest returns only passenger name, limited student ID,
Reserved/Walk-in kind, seat number where applicable, boarding/drop-off names,
boarded/alighted state, and whether alighting is expected at the current stop.
It excludes email, credit, penalties, appeals, and unrelated profile fields.

Student UI additions are limited to dynamic Reserved/Walk-in/Exit passes, journey
selection for Walk-in intent, and the mandatory non-guarantee warning. Driver UI
adds camera-first scan results, explicit demo paste fallback, manual operations,
manifest, delay, and stop progress controls without a broad visual redesign.

## Migration and reset behavior

Forward migration `20260815220000_phase_5_boarding_and_walkin` adds the three
Walk-in tables, alighting evidence, delay metadata, `TripStatusHistory`, enums,
checks, same-Trip foreign keys, and query-aligned indexes. Earlier migrations
are unchanged. It refuses populated legacy `Trip.status = DELAYED` rows because
inventing an operational lifecycle would be untruthful. The approved development
procedure remains reset, apply all migrations, and reseed; no non-demo legacy
data requires preservation.

The seed demonstrates an assigned driver, multi-stop Trip, segment-aware
reserved passengers, standing capacity, and one pending Walk-in intent. It does
not create admitted standing claims, GPS, or device state.

## Verification evidence

Local verification passes Architecture v2 lint, strict typecheck, 16
unit/specification test files, the expanded dependency-policy scan, Prisma
validation/generation in the writable diagnostic workspace, and whitespace
checks. Local PostgreSQL is unavailable; the fail-closed integration command
correctly refuses to use `DATABASE_URL` without `TEST_DATABASE_URL`. GitHub
Actions run `31840645562` applied the complete forward migration history to a
clean PostgreSQL 16 service and passed all 31 Phase 3–5 integration scenarios,
Architecture v2 lint, strict typecheck, all 16 unit/specification files, the
dependency-policy scan, and the production build at commit
`cca1d392d04b64660de992239bd835971a69378a`.

The Phase 5 PostgreSQL suite contains 12 grouped scenarios covering zero-capacity
issuance, complete segment claiming, adjacent standing reuse, partial-segment
full rejection, the concurrent final-capacity race, duplicate scans, wrong-Trip
and unassigned-driver rejection, reserved QR/manual convergence, purpose/expiry/
durable-record checks, minimal manifest projection, QR/manual/automatic
alighting with unchanged claims, closed passed stops, and irreversible legal
Trip transitions.

## Legacy compatibility and Phase 6 boundary

- `Seat`, `Seat.status`, seat-device models, and old admin/device surfaces remain
  temporary until the approved later cleanup. They are never consulted for
  reserved availability, standing capacity, or boarding eligibility.
- Phase 6 removes `Booking.qrTokenIssuedAt` and replaces the legacy penalty/no-show
  routes with one progress-aware, retry-safe implementation using the passenger's
  boarding TripStop.
- The GPS/schedule-interpolation replacement remains a later telemetry phase.
- Self-service account deletion remains disabled and frontend settings cleanup
  remains later scope.

Phase 5 remains bounded to boarding and journey operations. Phase 6 subsequently
implements idempotent no-show, credit, restriction, penalty, and appeal behavior
without changing Phase 5 planned-capacity semantics.
