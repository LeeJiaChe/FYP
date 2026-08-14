# Campus Shuttle Booking and Management System — Product Specification

Status: **Approved source of truth**

Owner amendments incorporated: 2026-08-14

This document defines the approved Final Year Project product. Architecture and
implementation must follow it. Approved operational defaults belong in one
validated server-side configuration module; feature code must not duplicate
them as magic numbers.

## 1. Product summary

Build one responsive web application for TAR UMT campus shuttle operations. It
has three role-specific portals over one PostgreSQL database:

1. Students search directional journeys, reserve a specific seat or request a
   non-guaranteed walk-in pass, board with QR, view their journeys, and manage
   penalties and appeals.
2. Drivers operate assigned trips, scan reserved and walk-in passes, use approved
   manual boarding/alighting fallbacks, update trip state, and view the manifest.
3. Transport administrators manage stops, routes, buses, trips, drivers,
   penalties, and operational analytics.

The application also exposes authenticated live trip occupancy and simulated GPS
location updates through a small standalone Socket.io process. PostgreSQL is the
durable source of truth; realtime messages are only update signals.

## 2. Product form and technical platform

- **Delivery:** responsive website usable on phone and desktop browsers.
- **Not a PWA:** installability, service workers, offline caching, web-app
  manifests, install prompts, and PWA-specific icons are not requirements.
- **Not a native application:** do not create React Native, Flutter, App Store, or
  Play Store projects.
- **Framework:** Next.js 16 App Router with TypeScript.
- **Database:** PostgreSQL.
- **ORM:** Prisma, with reviewed SQL migrations where PostgreSQL constraints are
  not expressible in the Prisma schema.
- **Realtime:** one small standalone Node.js and Socket.io process in
  `realtime/`. Next.js commits durable state before publishing an invalidation.
- **Styling:** Tailwind CSS and accessible shared UI primitives.
- **Authentication:** credentials with bcrypt password hashing and a JWT session
  in an HTTP-only cookie. Real TAR UMT SSO is out of scope.
- **Validation:** Zod at all external input boundaries.
- **QR rendering/signing:** `qrcode` and a dedicated QR signing secret.
- **Analytics:** bounded PostgreSQL/Prisma queries rendered with Recharts.
- **Jobs:** a simple scheduler for no-shows, reminders, and other approved retry-
  safe jobs. There is no seat-device simulation job.

The university shuttle is free. There are no fares, prices, payments, refunds,
payment gateways, or paid-ticket concepts.

## 3. Roles and authorization

| Role | Approved capabilities |
|---|---|
| Student | Search compatible journeys, reserve a seat, join a journey-aware waitlist, generate a walk-in pass, present reserved/walk-in/exit QR, view own history, notifications, credit, penalties, and appeals. |
| Driver | View only assigned trips, operate the current trip, scan passes, use authorized manual boarding/alighting fallbacks, view the minimum necessary manifest, and report delays/cancellations. |
| Admin | Manage fleet, stops, directional routes, schedules, and driver assignments; review appeals; inspect authorized live operations and historical analytics. |

Page redirects are not authorization. Every query and mutation must establish the
live actor and authorize the specific resource on the server.

## 4. Route, trip, and journey vocabulary

These terms are normative:

- A **Stop** is a reusable named boarding/alighting location with coordinates.
- A **Route** is one directional ordered list of approximately two to five
  distinct stops.
- The opposite direction is a separate Route. Do not implement circular routes.
- Do not implement transfers or journeys spanning multiple routes.
- A **Trip** is one scheduled execution of one Route by one bus and, normally,
  one assigned driver.
- A **TripStop** is the immutable per-trip snapshot of an ordered RouteStop,
  including planned timing and its boarding deadline.
- A **TripSegment** is the directed interval between two adjacent TripStops.
- A passenger **journey** has one boarding TripStop and one later drop-off
  TripStop on the same Trip. It traverses every TripSegment from the boarding
  position, inclusive, to the drop-off position, exclusive.

Example:

```text
Route: A -> B -> C
Journey A -> C traverses segments A-B and B-C.
Journey B -> C traverses only segment B-C.
```

Students search by `From -> To -> Date -> Departure`. The application finds
Routes where `From` occurs before `To`, then shows compatible Trips. “Segment” is
an internal capacity concept and is not a required user-facing wizard step.

## 5. Normative logical data model

`framework/ARCHITECTURE.md` contains the migration-oriented physical proposal.
The actual Prisma schema remains unchanged through Phase 2.

### 5.1 Identity and fleet

#### `User`

- UUID primary key, optional unique student ID, unique email, name, password
  hash, role, credit score, booking restriction, session version, timestamps.
- Student email input is trimmed, normalized to lowercase, and must use the
  `@student.tarc.edu.my` domain. Do not impose a stricter local-part or student-
  number pattern until TAR UMT provides an authoritative format.
- Student ID input is trimmed and normalized to uppercase before persistence and
  uniqueness checks.

#### `Bus`

- UUID primary key, unique plate number, status, `seatedCapacity`, and
  `standingCapacity`.
- Seated capacity must be positive. Standing capacity is configurable per bus and
  may be zero; it must never be negative.
- A universal standing-capacity constant is forbidden.

#### `Stop`

- UUID primary key, unique stable code, display name, latitude, longitude,
  optional soft-deletion/active state, timestamps.

#### `Route` and `RouteStop`

- `Route` owns its name and active/deleted state.
- `RouteStop` links one Stop to one Route at a zero- or one-based `position` used
  consistently throughout the application.
- Each non-terminal RouteStop stores the estimated travel duration to the next
  stop. The terminal RouteStop has no next-stop duration.
- `(routeId, position)` and `(routeId, stopId)` are unique. Repeated stops are
  therefore disallowed and a route must contain approximately two to five stops.
- Reverse travel is another Route, never an implicit reversal.

### 5.2 Trip topology and capacity snapshots

#### `Trip`

- Route, bus, optional driver, origin departure time, final estimated arrival,
  lifecycle status, disruption information, and timestamps.
- Lifecycle is `NOT_STARTED -> BOARDING -> DEPARTED -> ARRIVED`, with
  `CANCELLED` terminal. `ARRIVED` and `CANCELLED` cannot be reversed. Delay is
  disruption metadata such as `delayMinutes` and `delayReason`, not a lifecycle
  state.
- `seatedCapacity` and `standingCapacity` are copied from the Bus when the Trip is
  created. Later Bus edits must not rewrite scheduled or historical capacity.

#### `TripStop`

- Trip, source Stop, position, display-name/coordinate snapshot, planned arrival,
  planned departure, and per-stop boarding deadline.
- Planned times are derived from the Trip origin departure plus snapshotted Route
  travel-time offsets. Administrators do not manually enter every stop time.
- Optional actual arrival/departure/passed timestamps support progress and
  non-mandatory automatic alighting completion.
- Bookings and walk-in records reference TripStops, not mutable RouteStop rows.

#### `TripSegment`

- Trip, sequence/position, `fromTripStopId`, and `toTripStopId`.
- One row exists for each adjacent TripStop pair. All segment rows are created
  with the Trip in one transaction.

#### `TripSeat`

- Trip and physical seat number, unique together.
- It is inventory, not a whole-trip availability flag. A single mutable
  `AVAILABLE/RESERVED` seat status cannot represent segment reuse.

### 5.3 Reserved bookings and waitlist

#### `Booking`

- Student, Trip, TripSeat, boarding TripStop, drop-off TripStop, status, QR issue
  metadata, boarding timestamp/method, optional actual alighting timestamp/method,
  and timestamps.
- A confirmed Booking guarantees the selected seat over its complete planned
  journey.
- Multiple Bookings may reference the same TripSeat only when their segment sets
  do not overlap.

#### `ReservedSeatSegment`

- One row for every TripSegment occupied by an active reserved Booking.
- Fields: Booking, TripSeat, TripSegment.
- `(tripSeatId, tripSegmentId)` is unique. Creating all required rows in the same
  transaction makes overlapping seat claims fail safely under concurrency.
- Cancellation removes the active allocation rows in the cancellation
  transaction. The Booking retains boarding/drop-off history.
- Actual alighting does not shorten or extend the planned allocation. Reserved
  availability is always based on the planned journey.

#### `WaitlistEntry`

- Separate from Booking because it has no guaranteed seat.
- Student, Trip, boarding TripStop, drop-off TripStop, queue order/created time,
  status, optional promoted Booking, and timestamps.
- A student joins only when no single TripSeat is free across every requested
  TripSegment.
- Promotion must re-evaluate the entire requested journey and atomically create a
  Booking plus all segment allocations. A seat free on only part of the journey
  is not sufficient.
- Promotion is oldest-compatible-first FIFO. Evaluate active entries in their
  original queue order, promote the oldest entry whose complete journey fits,
  and permit a temporarily incompatible earlier entry to be skipped. A skipped
  entry retains its original priority for every later promotion attempt.

### 5.4 Walk-in intent and admitted standing journey

#### `WalkInIntent`

- Student, Trip, boarding TripStop, drop-off TripStop, pass issue/expiry metadata,
  status, and timestamps.
- It represents intent only. Creating it and issuing its QR consume no standing
  capacity and provide no guarantee of boarding.
- An eligible student may request it regardless of current reserved-seat
  availability. Do not create or retain a redundant active intent for the same
  student, Trip, and journey when that student already holds a confirmed reserved
  Booking for it.
- The UI and pass must state clearly: “Boarding is not guaranteed; standing
  capacity is checked when scanned.”

#### `WalkInJourney`

- Created only after a successful boarding-time admission.
- References one WalkInIntent and stores student, Trip, planned boarding/drop-off,
  boarded time/method, optional actual alighting time/method, and lifecycle
  status.
- A WalkInIntent can produce at most one WalkInJourney.

#### `StandingSegmentClaim`

- One row for each TripSegment traversed by an admitted WalkInJourney.
- `(walkInJourneyId, tripSegmentId)` is unique.
- Admission locks every requested TripSegment in ascending sequence, counts
  existing claims for each segment against the Trip's standing-capacity snapshot,
  and creates the WalkInJourney and all claims in one transaction.
- If any segment is full, the transaction creates no journey or claims and
  boarding is rejected as full.
- Claims use the planned journey. Alighting confirmation is operational evidence,
  not a prerequisite for correct capacity calculations.

### 5.5 Penalties, notifications, and location

#### `Penalty`, `PenaltyAppeal`, and `Notification`

- Keep the current concepts, with constraints and statuses aligned to the revised
  reserved-booking lifecycle. A Booking can receive at most one no-show penalty.
- In-app notifications remain core. Email, SMS, and push infrastructure are out
  of scope.

#### `TripLocationSample`

- Trip, latitude, longitude, recorded time, source type, and optional accuracy,
  speed, and heading.
- Source type distinguishes `SIMULATOR` from a future real `GPS` adapter.
- `(tripId, recordedAt)` is indexed. Samples are retained for seven days and then
  removed by a retry-safe retention job.
- Authorized APIs expose a source-neutral latest-location DTO. Student UI must
  label simulated prototype telemetry honestly.

There is no `DeviceStatusLog`, `DeviceSignal`, seat-sensor health model, or
device-health scheduler in the target product.

## 6. Student journeys

### 6.1 Search and availability

1. Student selects From, To, date, and a compatible departure.
2. The server matches directional Routes where From precedes To.
3. Results show the departure time at the requested boarding TripStop, not only
   the route-origin departure.
4. For a selected Trip/journey, availability returns seats with no
   `ReservedSeatSegment` conflict across any traversed TripSegment.
5. Whole-trip counts such as `Seat.status = AVAILABLE` are not valid availability
   evidence for a partial journey.

### 6.2 Reserved seat booking

1. Student selects one available TripSeat.
2. The use case validates actor, restriction status, Trip lifecycle/time window,
   boarding/drop-off ordering, and the complete requested segment set.
3. In one PostgreSQL transaction, create the Booking and all
   ReservedSeatSegment rows. Database uniqueness resolves concurrent conflicts.
4. The Booking is confirmed only after the transaction commits.
5. Publish a non-sensitive realtime invalidation after commit.

### 6.3 Journey-aware waitlist

If no single seat spans the complete journey, the student may create a
WaitlistEntry for that exact boarding/drop-off pair. Waitlisting does not reserve
partial segments. Cancellation or another approved release trigger re-runs
journey-aware promotion under the same locking/uniqueness rules as booking.

Promotion uses oldest-compatible-first FIFO: inspect entries in original queue
order and promote the first whose complete requested journey fits. An earlier
entry that cannot currently fit may be skipped but keeps its original priority;
never reorder it behind later entries.

### 6.4 Reserved pass

- A Reserved Pass is issued only for the owner of a confirmed Booking within the
  configured time window for that Booking's boarding TripStop.
- Its signed short-lived token includes a pass-purpose/type claim and identifiers
  for booking, student, trip, seat, boarding TripStop, and drop-off TripStop.
- A Reserved Pass represents a guaranteed existing seat allocation. Token
  expiry/reissue reduces replay risk but must not be described as encryption or
  absolute screenshot prevention.

### 6.5 Walk-in pass

1. An authenticated student selects boarding stop, drop-off stop, and Trip.
2. The server validates ordered stops and creates or reuses an active
   WalkInIntent.
3. It issues a signed Walk-in Pass tied to the student, intent, Trip, boarding
   TripStop, and drop-off TripStop.
4. No standing capacity is checked or consumed at issuance.
5. The UI states that admission is first-come-first-served at scanning and is not
   guaranteed.

Issuance is allowed regardless of current reserved-seat availability. It is
rejected as redundant when the same student already has a confirmed reserved
Booking for the same Trip and journey.

### 6.6 Cancellation, history, no-show, and penalties

- A reserved Booking may be cancelled before the approved cutoff relative to its
  boarding TripStop. Cancellation removes its active segment allocations and may
  trigger journey-aware waitlist promotion.
- Booking, waitlist, walk-in intent, admitted journey, boarding, and alighting
  histories must be represented honestly rather than collapsed into one status.
- No-show detection is relative to the passenger's boarding TripStop deadline,
  not a single route-origin deadline.
- No-show processing, penalty creation, credit deduction, restriction changes,
  and notifications must be retry-safe and transactionally consistent.
- Students may appeal penalties; administrators approve or reject with an
  optional comment. Credit restoration uses the current locked student record.

Default policy values are centralized and configurable: booking opens seven days
before Trip departure; reserved cancellation closes 30 minutes before the
passenger's boarding-stop planned departure; boarding opens 15 minutes before and
normally closes five minutes after that planned departure; an operational delay
may extend the closing window; dynamic QR tokens live for 60 seconds; initial
credit is 100; a no-show costs 15 points; and booking is restricted below 40
credit. These values are defaults, not constants to copy into handlers or UI.

## 7. Boarding and alighting

### 7.1 Common boarding validation

Every QR or manual boarding path validates:

- authenticated driver/admin actor and assigned-trip authorization;
- explicit pass type (`RESERVED` or `WALK_IN`);
- current Trip and boarding TripStop;
- ordered planned journey and drop-off;
- Trip lifecycle/current progress;
- token purpose, signature, expiry, and live backing record;
- student identity and duplicate boarding;
- reserved allocation or standing capacity, as applicable.

Reserved and walk-in scans may share transport and authorization helpers, but
their domain transitions remain separate.

The final web product must scan QR codes through a real browser camera. Paste-
token input may exist only as an explicitly labelled development/demo fallback.

### 7.2 Reserved boarding

Scanning a Reserved Pass atomically revalidates the confirmed Booking and marks
it boarded with the method (`QR` or approved manual fallback). It does not create
capacity: the seat was already guaranteed by ReservedSeatSegment rows.

### 7.3 Walk-in boarding

Scanning a Walk-in Pass:

1. validates the live intent and current boarding stop;
2. locks all traversed TripSegments in ascending order;
3. checks claim counts on every segment against the Trip standing-capacity
   snapshot;
4. creates one WalkInJourney and all StandingSegmentClaims if all fit;
5. otherwise rolls back and returns a clear “standing capacity full” result.

This is first-come-first-served at successful transaction commit. Two concurrent
scans must never exceed capacity.

### 7.4 Alighting

- Reserved Bookings and WalkInJourneys store their planned drop-off.
- An Exit QR may confirm actual alighting where practical.
- The assigned driver/admin has a manual “Confirm Alighted” fallback.
- When no confirmation occurs, a retry-safe job/use case may auto-complete after
  the Trip has passed the planned drop-off TripStop.
- A forgotten exit scan must never block future reserved-seat or standing-
  capacity calculations; planned segment allocations/claims are authoritative.

## 8. GPS location telemetry

Live bus location is core. Physical GPS hardware is not part of the FYP, but the
prototype must use realistic coordinate telemetry rather than schedule
interpolation.

Required flow:

```text
GPS simulator
  -> authenticated location-source adapter
  -> location ingestion use case
  -> PostgreSQL TripLocationSample
  -> post-commit Socket.io location.changed invalidation
  -> authorized latest-location query
  -> student live map
```

The simulator and a future physical GPS adapter implement the same input port and
contract. Ingestion validates Trip, lifecycle, timestamp freshness, coordinate
ranges, source authorization, and reasonable payload bounds. The UI consumes a
source-neutral DTO, displays recency, and identifies simulated/prototype data.
Replacing the source must not require rewriting the student map or Trip domain.
The simulator target interval is five seconds. Simulator samples pass through
the same ingestion use case as a future real adapter, and stored samples expire
after seven days.

Do not introduce a general IoT platform, message broker, or seat hardware for
this pipeline.

## 9. Driver, admin, realtime, and analytics

### 9.1 Driver portal

- Assigned trips and current progress only.
- Journey-aware manifest showing reserved seat, boarding/drop-off, boarding and
  alighting state, plus admitted walk-ins.
- Reserved QR scan, Walk-in QR scan, Exit QR scan, and approved manual fallbacks.
- Enforced Trip transition controls and delay/cancellation reporting.

### 9.2 Admin portal

- Bus CRUD with seated and standing capacity.
- Stop CRUD and directional Route CRUD with ordered two-to-five-stop validation.
- Trip scheduling with per-stop timing snapshot, bus/driver conflict checks, and
  generated TripStops, TripSegments, and TripSeats.
- Driver account/assignment management.
- Appeal review.
- Live journey-aware seated/standing occupancy and Trip state.
- Historical demand, no-show, seated utilization, standing admission/rejection,
  and route/time-slot analytics using bounded queries.

There is no seat-sensor status, device-health warning, or device simulation UI.

### 9.3 Realtime process

- Authenticates clients and authorizes Trip room membership.
- Accepts bounded, typed, authenticated internal events.
- Publishes non-PII invalidations for Trip, journey occupancy, notifications, and
  location updates.
- Does not access Prisma or own durable state.
- May host simple scheduler triggers, but jobs invoke idempotent Next.js use cases.

## 10. Required API capabilities

Exact paths may be normalized during feature migration, but these capabilities
must exist through thin App Router Route Handlers:

```text
Auth: register, login, logout, current user, password change
Stops/routes: compatible journey search; admin stop/route CRUD and ordering
Trips: list/detail/create/update; current progress; assigned-driver manifest
Reserved: journey availability; create/cancel booking; waitlist; reserved QR
Walk-in: create/list intent; Walk-in QR; boarding admission
Boarding: reserved scan/manual; walk-in scan/manual; alight QR/manual
Penalties/appeals: own penalties, submit appeal, admin review
Notifications: own list/read state
Location: authenticated ingestion; authorized latest Trip location/history window
Analytics: bounded utilization/no-show/demand/standing metrics
Internal jobs: no-shows, reminders, waitlist evaluation, auto-alighting
```

Every mutation uses Zod validation, live authentication, resource authorization,
typed errors, and the owning application use case.

## 11. Non-functional requirements

- Correctness and PostgreSQL concurrency evidence are mandatory for reserved
  segment allocation and walk-in standing admission.
- All multi-row transitions use explicit transactions, deterministic lock order,
  database constraints where possible, and retry/idempotency tests.
- External input, including IDs, query strings, QR payloads, realtime events, and
  location samples, is validated.
- Passwords and secrets are never logged or sent to clients.
- Students see only their own personal data. Drivers see passenger data only for
  assigned Trips and only what boarding operations require.
- The responsive UI supports phone browsers, keyboard navigation, browser zoom,
  reduced motion, labelled dialogs, loading/empty/error states, and non-color-only
  status cues.
- Realtime failure never corrupts durable state; clients recover by refetching.
- Seed data is deterministic, internally consistent, and includes overlapping and
  non-overlapping reserved journeys plus walk-in capacity scenarios.
- No claim is complete without unit, PostgreSQL integration, contract, and
  appropriate browser workflow evidence.

## 12. Required screens

- **Student:** login/register, From/To/date/departure search, journey-aware seat
  selection, waitlist state, reserved pass, walk-in request/pass disclaimer, own
  journey history, live simulated-GPS map, notifications, penalties, and appeal.
- **Driver:** login, assigned Trips, journey-aware manifest, reserved/walk-in/exit
  scanning and manual fallbacks, Trip lifecycle/progress, delay/cancellation.
- **Admin:** login, operational dashboard, stops/routes, buses, Trips/timetable,
  driver assignment, appeals, location/occupancy monitoring, and analytics.

## 13. Explicitly out of scope

- PWA installability, manifest behavior, service workers, offline caching, PWA
  icons, and install prompts.
- Native mobile applications.
- Circular routes, implicit reverse routes, transfers, and multi-route journeys.
- Fares, prices, payments, refunds, and payment gateways.
- Seat pressure sensors, seat hardware, `DeviceStatusLog`, `DeviceSignal`, device-
  health simulation, device-health cron jobs, and sensor dashboards.
- Physical GPS hardware. A GPS simulator and replaceable telemetry pipeline are
  in scope.
- Real TAR UMT SSO.
- Self-service account deletion and personal-data export. Existing non-functional
  settings for these are removed during frontend scope cleanup.
- SMS, email, and push-notification infrastructure.
- Microservices, event sourcing, a general IoT platform, Kafka/Redis, or other
  enterprise infrastructure without a separately approved concrete need.

## 14. Approved operating and migration decisions

- Terminal Trip states are irreversible. A future admin emergency cancellation
  after departure requires a reason and a minimal append-only
  `TripStatusHistory` audit record; Phase 1 does not implement it.
- Camera scanning is required in the final web product; token paste is only a
  development/demo fallback.
- Route travel-time offsets derive TripStop planned times.
- Proposal citation verification belongs to final documentation and defence work
  and does not block implementation.
- No existing non-demo data must survive Architecture v2. Because legacy
  Bookings have no truthful boarding/drop-off data, the development database may
  be reset and deterministically reseeded during the approved migration phase.
- The deployment shape for the long-running realtime, scheduler, and simulator
  processes remains an implementation/deployment decision, not an unresolved
  product rule.

All product decisions required to begin Phase 3 have now been recorded. Later
implementation discoveries may still require an ADR, but must not silently alter
these rules.
