# TAR UMT Kuala Lumpur Campus Shuttle Management System
## Canonical Product, Domain, Architecture, and AI Handoff Specification

**Document version:** 3.1
**Date:** 2026-08-21
**Project:** BMCS3403 / Final Year Project
**Primary deployment context:** TAR UMT Kuala Lumpur Main Campus
**Repository:** `LeeJiaChe/FYP`
**Primary development branch during Architecture v2 migration:** `architecture-v2`
**Status:** **Canonical product source of truth.**
**Implementation baseline covered by this document:** Architecture v2 Phases 0–9 completed and verified; Phase 9.5 operational booking-time alignment and browser-E2E closure completed and verified.

---

# 0. HOW TO USE THIS DOCUMENT

This document is intentionally much more detailed than a normal product specification. It is designed so that a new developer, AI coding agent, supervisor, moderator, or reviewer can read one document and understand:

- the real-world problem being addressed;
- what is currently true about the observed TAR UMT KL shuttle process;
- which parts are proposed system changes rather than current university practice;
- product scope and non-scope;
- terminology and domain concepts;
- student, driver, and administrator workflows;
- the exact capacity model;
- all major state machines;
- database model intent;
- concurrency and locking rules;
- authorization and security boundaries;
- GPS/realtime behavior;
- analytics definitions;
- folder/module ownership;
- API/transport rules;
- testing expectations;
- known implementation status and known pending corrections.

This is not merely a description of the current code. It is the target product and engineering contract.

A coding agent MUST NOT change product behavior simply because existing code currently behaves differently. If code and this document disagree, first identify whether the difference is listed under **Known Implementation Deltas**. If not, stop and ask for a product decision rather than silently making one up.

---

# 1. SOURCE-OF-TRUTH HIERARCHY

When sources disagree, use this order:

1. **This Canonical Product, Domain, Architecture, and AI Handoff Specification.**
2. Explicit later owner decisions recorded after this document.
3. `framework/ARCHITECTURE.md` for implementation structure and dependency direction.
4. Phase implementation reports for evidence of what was implemented in a given phase.
5. `prisma/schema.prisma`, current feature code, and tests as evidence of present implementation.
6. README and NOTES as operational documentation.
7. Proposal/report material as academic framing, not as authoritative product behavior.
8. Historical audits and old migrations as historical evidence only.

Never rewrite the product specification to match an accidental implementation bug.

---

# 2. FACT CLASSIFICATION: CURRENT REALITY VS PROPOSED SYSTEM

A major lesson from the original proposal is that the system must never present proposed features as if TAR UMT already has them.

## 2.1 Owner-observed current KL Main Campus process

The project owner is a TAR UMT Kuala Lumpur Main Campus student and has directly observed the following current passenger process:

- The shuttle service is free to students.
- There is currently no advance seat reservation in the observed process.
- Students generally go to the bus stop, queue, and board when the shuttle arrives.
- Boarding is effectively first-come-first-served according to available physical capacity.
- The observed boarding process does not normally involve checking a student card, QR code, or bus ticket.
- Passengers may stand when seats are unavailable and standing capacity permits.
- Existing seats are not presently presented to passengers as selectable numbered seats; passengers normally sit in any available seat.
- Published timetables exist, but actual arrival can differ significantly because of road traffic and accumulated delays.
- Peak periods can produce long queues, uncertainty about whether the arriving bus will still have space, and a risk of students being late.
- Students may continue waiting because they do not know where the shuttle currently is; if they knew a long delay existed, they might choose another transport mode.

These are **owner-observed operational facts**, not claims that TAR UMT has formally documented these exact boarding rules as institutional policy.

## 2.2 Publicly verifiable TAR UMT KL information

The official TAR UMT Department of Student Affairs currently publishes:

- KL shuttle route groups;
- shuttle schedules;
- service information/update channels.

Official KL route group names currently include:

- **Wangsa Maju**
- **Teratai Residency**
- **Jalan Genting Klang**
- **Melati Utama**
- **PV10, PV12, PV13, PV15**

The current public route page describes connections including:

- TAR UMT, Tarvilla, LRT Wangsa Maju, Wangsa Maju Section 2;
- TAR UMT, Teratai Residency, Prima Setapak, Bus Stop Jalan Genting Kelang;
- TAR UMT, Prima Setapak, Bus Stop Jalan Genting Kelang;
- TAR UMT, Melati Utama, Melati LRT;
- TAR UMT, Setapak Central, PV12, PV10, PV13, PV15.

Exact route-map topology should be rechecked against the current official route maps before final demo seeding. Never invent a TAR UMT route or stop and present it as official.

## 2.3 Unknown current university internals

The project does **not** know and must not claim without evidence:

- whether TAR UMT transport administrators internally use spreadsheets;
- what fleet-management software they currently use;
- exact internal bus dispatch rules;
- exact official passenger standing limits for every bus;
- exact official seat numbering policy;
- exact internal driver-account workflow;
- exact operations at Penang, Johor, or other campuses.

The prototype is focused on KL Main Campus. Its architecture may be adaptable to other campuses, but other campuses require separate requirement validation.

## 2.4 Proposed operational changes introduced by this FYP

The following are **proposed**, not descriptions of the present TAR UMT process:

- advance journey-based seat reservation;
- simple physical seat labels/numbers on buses for reservable seats;
- authenticated student accounts;
- QR-based reserved boarding;
- QR-based walk-in intent/admission;
- trip manifests;
- digital no-show/credit/appeal workflow;
- live bus location through a GPS ingestion pipeline;
- integrated transport admin portal;
- realtime occupancy/location invalidation.

---

# 3. PRODUCT VISION

Build a responsive web-based campus shuttle management prototype that reduces uncertainty around:

1. **where the shuttle actually is;**
2. **whether a student can secure seated capacity before travelling to the stop;**
3. **whether a non-reserved student may still attempt to board;**
4. **how passenger boarding, no-show, and capacity records are managed;**
5. **how routes, buses, drivers, trips, cancellations, and operational monitoring are coordinated.**

The project does **not** solve traffic congestion and does **not** guarantee buses will arrive according to timetable.

The timetable is used primarily to identify and plan a scheduled **Trip**.

Actual operational truth comes from:

- driver-controlled Trip progress;
- actual TripStop arrival/departure/passed timestamps;
- persisted GPS telemetry;
- durable passenger records.

A delayed 9:00 service is still the same 9:00 planned Trip. It does not become a different Trip because it physically arrives at 9:25.

---

# 4. KEY PRODUCT PRINCIPLE: PLANNED TIME IS NOT OPERATIONAL TRUTH

This principle is central to the final system.

## 4.1 Planned schedule

Planned times are needed to:

- create and identify Trips;
- allow advance search;
- open reservations in advance;
- calculate route timetable snapshots;
- show the planned service to students;
- support basic planning and analytics.

## 4.2 Operational progress

Operational state must override timetable assumptions for actions affected by delay.

Examples:

- A student must not be declared a no-show merely because scheduled time has passed.
- A reservation must not become invalid merely because traffic delayed the bus beyond the published time.
- Boarding is closed only when the bus has actually departed/passed the passenger's boarding stop.
- Live location must come from telemetry, not from “percentage of scheduled journey time elapsed.”

## 4.3 What the app does not promise

The application does not promise:

- exact ETA prediction;
- traffic avoidance;
- timetable adherence;
- faster road travel;
- zero queueing;
- faster physical boarding than a no-check queue.

QR validation introduces an additional boarding interaction. Its purpose is reservation validation, capacity control, and reliable records—not the claim that scanning itself is faster.

---

# 5. PRODUCT FORM

## 5.1 Delivery

- Responsive website.
- Mobile browser and desktop browser.
- One codebase.
- No native Android/iOS app.
- No PWA installability.

## 5.2 Portals

Three role-specific portals:

1. **Student**
2. **Driver**
3. **Admin**

All use one PostgreSQL source of truth.

## 5.3 Runtime units

The final architecture has three runtime units:

1. Browser
2. Next.js application
3. Small standalone Socket.io/realtime process

This is a modular monolith plus a realtime helper process, not microservices.

---

# 6. TECHNICAL PLATFORM

Target/current Architecture v2 technology:

- **Next.js 16 App Router**
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **PostgreSQL**
- **Prisma ORM 6**
- **Zod 4**
- **JWT sessions in HTTP-only cookies**
- **bcrypt password hashing**
- **qrcode**
- **Socket.io**
- **node-cron**
- **Recharts**
- **Lucide React**
- **Node.js 20+**
- Node built-in `node:test` with `tsx` for current unit/integration execution
- Playwright browser E2E, added in Phase 9

Do not replace PostgreSQL with SQLite.

---

# 7. NON-GOALS / EXPLICIT OUT OF SCOPE

The following are explicitly out of scope unless later approved:

- payment;
- fares;
- tickets with monetary value;
- refunds;
- payment gateways;
- native mobile app;
- PWA installation;
- service worker;
- offline application mode;
- real TAR UMT SSO;
- physical seat pressure sensors;
- seat sensor health;
- DeviceStatusLog / DeviceSignal;
- physical GPS hardware in the FYP;
- ETA prediction engine;
- traffic prediction;
- circular routes;
- implicit reverse route logic;
- transfers between multiple routes;
- multi-route journeys;
- seat switching mid-journey;
- self-service account deletion;
- self-service personal-data export;
- fake 2FA settings;
- email/SMS/push-notification infrastructure;
- Redis;
- Kafka;
- distributed locks;
- CQRS;
- event sourcing;
- Kubernetes;
- generic enterprise workflow engines;
- generic repository/service frameworks with no concrete need.

---

# 8. DOMAIN GLOSSARY

## Stop

A reusable physical boarding/alighting location.

Example:
- TAR UMT
- LRT Wangsa Maju
- Setapak Central

## Route

One directional ordered sequence of Stops.

The reverse direction is a separate Route.

Example:

`TAR UMT -> LRT Wangsa Maju`

and

`LRT Wangsa Maju -> TAR UMT`

are two directional Route records.

## RouteStop

A Stop placed at a specific position inside a Route template.

It also stores estimated travel duration to the next RouteStop.

## Trip

One scheduled execution of one Route, with:

- one Bus;
- normally one Driver;
- one planned origin departure time;
- immutable TripStop/TripSegment snapshots;
- snapshotted seated and standing capacities.

## TripStop

Immutable per-Trip snapshot of a RouteStop.

It contains planned time and operational progress evidence.

## TripSegment

One adjacent interval between two TripStops.

For:

`A -> B -> C`

segments are:

- A-B
- B-C

## Journey

One passenger's travel interval on one Trip.

Journey A->C uses segments A-B and B-C.

## TripSeat

A numbered physical seat inventory item for one Trip.

It has no whole-trip AVAILABLE/RESERVED status.

## Booking

A guaranteed reserved seat journey.

## ReservedSeatSegment

One database allocation claim that says:

> this TripSeat is occupied on this TripSegment by this Booking.

## WaitlistEntry

A non-guaranteed request for a specific From/To journey when no single seat is currently available across the whole journey.

## WalkInIntent

A student's intention to try boarding without a reserved seat.

It consumes no capacity.

## WalkInJourney

A durable record created only after a walk-in passenger is actually admitted at boarding.

## StandingSegmentClaim

One standing-capacity claim for one segment of an admitted WalkInJourney.

## Reserved Pass

Short-lived signed QR representing an existing guaranteed Booking.

## Walk-in Pass

Short-lived signed QR representing a WalkInIntent.

It does not guarantee admission.

## Alighting Pass

Short-lived signed QR used as optional operational evidence that a boarded passenger has alighted.

---

# 9. ROLE MODEL

## 9.1 Student

May:

- register with TAR UMT student email;
- login/logout;
- search From/To journeys;
- choose date;
- choose departure;
- view journey-specific available seats;
- create one reserved Booking;
- cancel an eligible Booking;
- join waitlist;
- view waitlist state;
- generate Walk-in Pass;
- display Reserved Pass;
- display Walk-in Pass;
- display Alighting Pass where appropriate;
- view own reservations/walk-in history;
- view live bus location;
- view notifications;
- view credit;
- view penalties;
- submit one appeal per eligible penalty.

Must not:

- view other students' records;
- operate driver/admin Trip controls;
- write GPS telemetry;
- select another student's pass;
- reserve overlapping seats by bypassing the API;
- receive server secrets.

## 9.2 Driver

May:

- login;
- view assigned Trips only;
- open current manifest;
- scan Reserved/Walk-in/Alighting passes;
- use approved manual boarding fallback;
- use manual alighting fallback;
- start boarding;
- depart current stop;
- arrive at next stop;
- complete Trip;
- report/set delay where authorized;
- perform explicitly authorized emergency cancellation.

Must not:

- operate an unassigned Trip by supplying another tripId;
- view unrelated student records;
- see credit/penalties unless explicitly needed—which they are not;
- change capacity;
- manage fleet templates;
- directly mutate Prisma state from UI/Route Handler.

## 9.3 Admin

May:

- manage Stops;
- manage directional Routes;
- manage Buses;
- manage Drivers;
- schedule Trips;
- safely reschedule eligible empty Trips;
- cancel Trips;
- manage bus maintenance/retirement;
- inspect operational manifests;
- monitor current occupancy;
- view simulated GPS telemetry;
- view analytics;
- review penalty appeals.

Must not receive or expose password hashes/session secrets.

---

# 10. IDENTITY RULES

## 10.1 Student registration

Student email:

- trim;
- lowercase;
- must end with exactly `@student.tarc.edu.my`;
- do not invent a stricter student-number/local-part pattern unless authoritative evidence exists.

Student ID:

- trim;
- uppercase;
- use reasonable generic length/character validation;
- unique when present.

## 10.2 Password

- Store only bcrypt hash.
- Never return `passwordHash`.
- Password requirements should be visible in UI if enforced.

## 10.3 Session

- JWT session stored in HTTP-only cookie.
- Session and QR signing secrets must be different.
- Session contains minimal stable identity/role claims.
- Protected operations re-read/validate live server state where required.
- Proxy redirects are convenience only, never authorization.

---

# 11. PHYSICAL BUS CAPACITY MODEL

Each Bus has:

- `seatedCapacity > 0`
- `standingCapacity >= 0`

Each Trip snapshots both values at creation.

Later Bus edits must not change historical/scheduled Trip capacity.

## 11.1 Proposed seat numbering

Current observed buses do not require passengers to choose numbered seats.

The proposed reservation system requires simple physical seat identifiers, for example:

`1, 2, 3, ... seatedCapacity`

This is a deployment change introduced by the system.

Trip creation generates TripSeats 1 through seatedCapacity.

## 11.2 Walk-in passengers and physical seats

A Walk-in passenger is admitted against **standing capacity**, not a numbered-seat reservation.

Operationally, a walk-in passenger may temporarily sit in an unoccupied numbered seat if allowed.

However:

- they do not acquire that seat;
- the system still treats their entitlement as walk-in/standing admission;
- if a reserved passenger boards later and owns that seat for the next segment, the walk-in passenger must yield it.

This conservative design prevents temporary physical seating from stealing future reserved entitlement.

---

# 12. ROUTE AND TOPOLOGY RULES

A Route:

- is directional;
- contains 2–5 Stops for the prototype;
- contains no repeated Stop;
- has contiguous positions;
- has a positive travel duration to next stop for every non-final RouteStop;
- has null next-stop duration for final RouteStop;
- is not circular.

Reverse travel must use a separate Route.

Route editing affects future Trip creation only.

Existing TripStop/TripSegment snapshots never change because the route template changed.

---

# 13. REAL TAR UMT DEMO ROUTE REQUIREMENT

Any demo/seed data presented as TAR UMT must use real official route-group names.

Allowed verified route groups include:

- Wangsa Maju
- Teratai Residency
- Jalan Genting Klang
- Melati Utama
- PV10, PV12, PV13, PV15

Directional records may add application-specific suffixes such as:

- `Wangsa Maju — Outbound`
- `Wangsa Maju — Inbound`

The underlying route group name and stops must remain based on current official TAR UMT information.

Do not invent:

- “TAR UMT -> Wangsa Maju -> Setapak Central” if that exact topology is not official;
- fake route numbers;
- fake official stop names.

Demo departure times may be deterministic/near-future prototype times. Do not claim those demo times are the live university timetable unless they were verified from the current official schedule.

---

# 14. TRIP CREATION AND SNAPSHOTS

When Admin schedules a Trip:

1. authorize Admin;
2. validate active Route;
3. validate Route topology;
4. validate active Bus;
5. validate Driver role if assigned;
6. calculate all TripStop planned times from route travel-duration offsets;
7. snapshot seatedCapacity and standingCapacity;
8. reject Bus overlap;
9. reject Driver overlap;
10. create Trip;
11. create TripStops;
12. create exactly N-1 TripSegments;
13. create TripSeats 1..seatedCapacity;
14. commit in one transaction.

Trip creation must not create the removed legacy Seat table.

---

# 15. SCHEDULING CONFLICT RULE

Two non-cancelled Trips conflict for the same Bus or Driver when intervals overlap.

Use half-open interval logic:

`existing.departure < candidate.arrival AND existing.arrival > candidate.departure`

Use PostgreSQL transaction/advisory locking so two concurrent schedules cannot both pass the same pre-check.

No scheduling optimizer is needed.

---

# 16. TRIP EDITING

A Trip is structurally immutable after passenger state exists.

An empty `NOT_STARTED` Trip may safely change:

- planned origin departure;
- assigned Driver.

A time shift must shift all TripStop planned timestamps by the same offset.

If there is any:

- Booking;
- WaitlistEntry;
- WalkInIntent;
- WalkInJourney;

then structural changes are rejected.

To change Route, Bus, topology, or capacity after passenger state exists:

> cancel the Trip and create a replacement.

Do not migrate passengers automatically to a different Trip.

---

# 17. TRIP LIFECYCLE

Final lifecycle:

`NOT_STARTED -> BOARDING -> DEPARTED -> ARRIVED`

Cancellation:

`NOT_STARTED | BOARDING | DEPARTED -> CANCELLED`

Terminal:

- ARRIVED
- CANCELLED

Terminal states cannot reverse.

`DELAYED` is not a Trip status.

Delay is metadata:

- `delayMinutes`
- `delayReason`

GPS must not automatically advance Trip lifecycle.

---

# 18. TRIPSTOP OPERATIONAL PROGRESS

TripStop contains:

- plannedArrival;
- plannedDeparture;
- planned boarding-window information;
- actualArrival;
- actualDeparture;
- passedAt.

Driver progression determines operational truth.

Conceptually:

1. Start boarding at current stop.
2. Depart current stop.
3. Arrive next stop.
4. Board/alight.
5. Depart next stop.
6. Repeat.
7. Arrive final stop.
8. Trip -> ARRIVED.

Operational progress drives:

- boarding eligibility;
- no-show;
- auto alighting;
- cancellation cutoff;
- late-service handling;
- current occupancy segment.

---

# 19. STUDENT JOURNEY SEARCH

Final user-facing search order:

**From -> To -> Date -> Departure -> Seat**

Never expose TripSegment as a normal wizard step.

Search behavior:

1. Student chooses From.
2. Student chooses later To.
3. Server finds directional Routes containing both in correct order.
4. Student chooses date.
5. Server shows compatible Trips.
6. Display departure at the student's boarding TripStop, not only route-origin time.
7. Student selects Trip/departure.
8. Server computes seats free across the full journey.
9. Student chooses seat.

---

# 20. RESERVED BOOKING CORE INVARIANT

For one selected TripSeat and one passenger journey:

> Seat is available if and only if that TripSeat has no active ReservedSeatSegment on any TripSegment traversed by the requested journey.

Example:

Route:

`A -> B -> C`

Seat 5:

- Student 1 books A->B.
- Student 2 books B->C.

Allowed because claims do not overlap.

Student 3 requests A->C on Seat 5.

Rejected because A->C traverses both A-B and B-C and therefore overlaps existing claims.

This is the most important booking invariant.

---

# 21. RESERVED BOOKING DATABASE GUARANTEE

Creating a Booking inserts one `ReservedSeatSegment` per traversed segment.

Database uniqueness:

`UNIQUE(tripSeatId, tripSegmentId)`

is the final overlap protection.

Booking + all claims are created atomically.

If one claim conflicts, the entire Booking transaction rolls back.

Never rely on:

`check availability -> later insert`

without database uniqueness.

---

# 22. RESERVED BOOKING ELIGIBILITY

A student may create a reserved Booking only when:

- authenticated as STUDENT;
- user exists;
- creditScore >= restriction threshold;
- Trip is not cancelled/arrived;
- requested boarding/drop-off form a valid ordered same-Trip journey;
- student does not already hold another active confirmed reserved Booking on the same Trip;
- booking has opened;
- boarding at the requested stop has not yet begun;
- selected TripSeat belongs to the Trip;
- selected TripSeat is free across every required segment.

## 22.1 Booking opening

Default advance opening:

**7 days before the passenger's planned boarding-stop departure.**

This is a planning rule and may safely use planned time.

## 22.2 FINAL booking closing rule

Because TAR UMT arrival can be heavily delayed, the final product MUST NOT close a reservation merely because the published/planned departure clock has passed.

**Final rule: booking closes when operational boarding begins at the passenger's boarding TripStop.**

Before operational boarding begins, a delayed Trip may still accept an otherwise valid reservation even if planned time has passed.

Once that stop has begun boarding, departed, or passed, new reserved booking is closed for that stop.

This superseded the historical Phase 8 implementation that rejected booking at `now >= plannedDeparture`; Phase 9.5 corrected the active implementation.

---

# 23. RESERVED CANCELLATION

## 23.1 FINAL cancellation rule

A student may cancel a confirmed reserved Booking **until operational boarding begins at that student's boarding TripStop**.

This replaces the old fixed rule:

`30 minutes before scheduled boarding departure`

because timetable delay makes a fixed planned-time cutoff unfair and operationally inaccurate.

## 23.2 Operational interpretation

Cancellation is allowed while the boarding stop has not begun active boarding.

At minimum, cancellation is closed when:

- the Trip is actively BOARDING at that passenger's boarding stop; or
- that TripStop has actual arrival/current-stop boarding evidence; or
- that TripStop has actualDeparture; or
- that TripStop has passedAt.

Exact implementation may reuse existing Trip progress fields without adding unnecessary schema.

## 23.3 Cancellation transaction

Cancellation:

1. authorize owner;
2. lock Trip/Booking as required;
3. re-read operational progress;
4. reject if boarding already started;
5. Booking CONFIRMED -> CANCELLED;
6. delete active ReservedSeatSegment claims;
7. preserve Booking history;
8. evaluate waitlist using authoritative promotion logic;
9. create durable notification where appropriate;
10. commit;
11. publish best-effort realtime invalidation.

---

# 24. WAITLIST

Waitlist is separate from Booking.

A WaitlistEntry contains:

- student;
- Trip;
- boarding TripStop;
- drop-off TripStop;
- immutable queue priority (`queuedAt`);
- status;
- optional promoted Booking.

No seat is allocated while WAITING.

No ReservedSeatSegment exists for a WAITING entry.

## 24.1 Joining

A student may join only when:

- otherwise eligible;
- no one TripSeat is free for the entire requested journey;
- no active reserved Booking on that Trip;
- no duplicate active waitlist entry for that journey;
- boarding at that stop has not begun.

Do not waitlist a student merely because one selected seat is occupied when another seat can satisfy the full journey.

## 24.2 Fairness

Use:

**oldest-compatible-first FIFO**

Order by original queue time.

For each WAITING entry:

- check whether its full journey now fits;
- if it does, promote it;
- if it does not, skip it without changing its priority.

A skipped older entry remains older for future promotion attempts.

## 24.3 Promotion

Promotion atomically creates:

- Booking;
- full ReservedSeatSegment set;
- WaitlistEntry -> PROMOTED.

Promotion must not occur for a boarding stop that has already begun boarding/departed/passed.

Trip cancellation never triggers waitlist promotion.

---

# 25. RESERVED SEAT ENTITLEMENT

A confirmed Booking guarantees one numbered seat only across its planned journey.

It does not guarantee:

- bus punctuality;
- the seat before the passenger's boarding stop;
- the seat after the passenger's drop-off stop.

A student boarding at B has no right to reserve/occupy the seat for A->B.

This is what allows seat reuse.

---

# 26. WALK-IN CONCEPT

Walk-in exists because the proposed system must not require every student to reserve in advance.

The current real-world service is flexible first-come boarding. The proposed app preserves some of that flexibility through Walk-in Passes.

## 26.1 WalkInIntent

Creating a WalkInIntent:

- records intention only;
- consumes zero seated capacity;
- consumes zero standing capacity;
- guarantees nothing.

Student selects:

- Trip;
- From;
- To.

## 26.2 Issuance

Walk-in intent may be created even when reserved seats remain.

Do not require “reserved seats sold out.”

Do not allow a redundant active WalkInIntent when the same student already owns a confirmed reserved Booking on the same Trip.

## 26.3 Pass wording

UI must clearly say:

> **This pass does not guarantee boarding. Standing capacity is checked when the driver scans your pass.**

Never say:

- seat booked;
- booking confirmed;
- guaranteed place.

---

# 27. WALK-IN ADMISSION

Actual walk-in capacity is claimed only at successful scan.

Process:

1. Driver is authenticated.
2. Driver must be assigned to Trip.
3. Verify WALK_IN_BOARDING token.
4. Re-read WalkInIntent.
5. Validate same Trip and current boarding stop.
6. Derive required TripSegments server-side.
7. Lock Trip and/or requested TripSegments in deterministic order.
8. Count StandingSegmentClaim rows for every requested segment.
9. Compare each count to Trip.standingCapacity.
10. If every segment has capacity:
   - create WalkInJourney;
   - create one StandingSegmentClaim per segment;
   - WalkInIntent -> BOARDED.
11. Otherwise:
   - create no journey;
   - create no claim;
   - return FULL;
   - mark attempt consistently (currently REJECTED_FULL).

Capacity is first-come-first-served by successful scan/transaction, not pass issue time.

---

# 28. STANDING CAPACITY INVARIANT

For each TripSegment:

`standing claims <= Trip.standingCapacity`

A walk-in journey A->C is admitted only when every segment A-B and B-C is below standing capacity.

Example:

Standing capacity = 1.

Existing passenger occupies A-B only.

New walk-in requests B-C.

Allowed.

New walk-in requests A-C.

Rejected because A-B is full.

---

# 29. WALK-IN TEMPORARY SEATING

A walk-in passenger may physically sit in an unoccupied numbered seat if one is temporarily empty.

The database does not convert that into a reserved Booking.

The walk-in passenger remains represented by:

- WalkInJourney;
- StandingSegmentClaims.

If the seat becomes reserved from a later stop, the walk-in passenger yields it.

This is an operational courtesy, not a seat allocation.

---

# 30. QR PASS CONTRACTS

Three explicit purposes:

- `RESERVED_BOARDING`
- `WALK_IN_BOARDING`
- `ALIGHTING`

Do not use one ambiguous generic QR purpose.

A signed pass may contain minimal identifiers such as:

- purpose;
- journeyKind;
- recordId;
- studentId;
- tripId;
- iat;
- exp;
- jti.

Token claims are not the source of truth.

After signature verification, always re-read PostgreSQL.

JWT is signed, not encrypted.

Do not claim QR is impossible to screenshot.

Short lifetime reduces replay usefulness; durable state validation prevents token claims from authorizing stale state.

---

# 31. QR TOKEN LIFETIME

Default:

**60 seconds**

The UI may refresh/reissue a pass.

Never store a permanent reusable bearer QR token as the reservation.

---

# 32. RESERVED BOARDING

Reserved boarding validates:

- DRIVER actor;
- assigned Trip;
- correct token purpose;
- correct Trip;
- correct Booking;
- Booking owner/backing record;
- Booking status CONFIRMED;
- passenger not already boarded;
- current TripStop is correct;
- stop has not passed;
- Trip lifecycle permits boarding.

On success:

- set `checkedInAt`;
- set `checkInMethod = QR` or MANUAL;
- preserve ReservedSeatSegment claims.

Boarding does not create seat capacity; the seat was already allocated.

Duplicate scans are idempotent/return ALREADY_BOARDED rather than corrupting state.

---

# 33. MANUAL BOARDING FALLBACK

Manual fallback exists for operational resilience.

Examples:

- camera cannot detect QR;
- phone problem;
- pass display issue.

Manual boarding must call the same authoritative boarding use case with token verification omitted.

Do not maintain a second independent transition implementation.

---

# 34. CAMERA SCANNER

Final UX:

- camera scanning is primary;
- browser permission state handled;
- unsupported camera/BarcodeDetector state handled;
- invalid/expired/wrong Trip/full/already boarded states displayed clearly;
- paste token remains visibly labeled:
  **Development / Demo fallback**.

CI does not need a physical webcam.

Browser E2E may use the token fallback for deterministic mutation tests.

---

# 35. ALIGHTING

Every reserved/walk-in passenger already has a planned drop-off.

Actual alighting is operational evidence.

Supported methods:

- QR
- MANUAL
- AUTO_PLANNED_STOP

## 35.1 Capacity rule

Actual alighting never changes planned capacity claims.

Do not dynamically shorten ReservedSeatSegment or StandingSegmentClaim when a student exits early.

Do not extend claims because a student forgot Exit QR.

Capacity remains deterministic from planned journey.

## 35.2 Auto completion

When Trip progress leaves/passes a passenger's planned drop-off stop:

- if boarded;
- and no actual alighting evidence exists;

auto-complete with `AUTO_PLANNED_STOP`.

No high-frequency alighting cron is necessary if Trip progress can trigger it.

---

# 36. NO-SHOW

No-show applies **only** to confirmed reserved Bookings.

Walk-in intents/journeys never receive reserved no-show penalties.

A Booking is NO_SHOW only when:

- status CONFIRMED;
- `checkedInAt` is null;
- the passenger's own boarding TripStop has actualDeparture or passedAt evidence.

Planned time alone is insufficient.

This is critical for traffic delays.

---

# 37. NO-SHOW TRANSACTION

One authoritative implementation:

1. lock Trip;
2. identify candidate Booking;
3. lock Booking;
4. re-read;
5. verify no-show;
6. Booking -> NO_SHOW;
7. release ReservedSeatSegment claims;
8. lock User credit;
9. create exactly one Penalty;
10. deduct bounded credit;
11. create deduplicated notification;
12. run authoritative waitlist promotion for future compatible passengers;
13. commit.

Reconciliation job calls the same use case.

No duplicate cron logic.

---

# 38. CREDIT

Credit range:

`0..100`

Default initial credit:

`100`

No-show deduction default:

`15`

Booking restriction:

`creditScore < 40`

Therefore:

- 40 = allowed
- 39 = restricted

Restriction is derived from creditScore.

Do not persist a second boolean source of truth.

Credit cannot fall below 0.

Appeal restoration cannot exceed 100.

---

# 39. PENALTY

One reserved Booking can produce at most one no-show Penalty.

Database:

`Penalty.bookingId UNIQUE`

Penalty stores actual `creditPointsDeducted`.

This matters when student has fewer than 15 points remaining.

Example:

credit = 5

no-show:

- final score = 0
- recorded deduction = 5

If appeal later approved, restore 5, not 15.

---

# 40. PENALTY LIFECYCLE

`ACTIVE -> APPEALED -> OVERTURNED | UPHELD`

Meanings:

- ACTIVE: issued, no appeal pending.
- APPEALED: student submitted one appeal.
- OVERTURNED: admin approved; recorded points restored.
- UPHELD: admin rejected; deduction remains.

---

# 41. APPEAL LIFECYCLE

`PENDING -> APPROVED | REJECTED`

Rules:

- student may appeal own penalty only;
- one appeal per penalty;
- reason required and bounded;
- submit transaction changes Penalty ACTIVE -> APPEALED;
- no credit restored at submission;
- only Admin resolves;
- approval locks live user credit and restores exact penalty deduction;
- resolution is idempotent;
- concurrent admins cannot restore twice.

---

# 42. TRIP CANCELLATION

One authoritative cancellation coordinator serves:

- direct Admin cancellation;
- allowed Driver emergency cancellation;
- Bus maintenance/retirement cancellation of future NOT_STARTED Trips.

Transaction:

1. lock Trip;
2. authorize actor/source;
3. require reason;
4. reject ARRIVED;
5. if already CANCELLED, return idempotent result;
6. release active ReservedSeatSegment claims;
7. CONFIRMED Bookings -> CANCELLED;
8. WAITING WaitlistEntries -> CANCELLED;
9. PENDING WalkInIntents -> CANCELLED;
10. append TripStatusHistory;
11. Trip -> CANCELLED;
12. create deduplicated notifications;
13. no waitlist promotion;
14. no no-show penalty.

Historical rows remain.

---

# 43. BUS LIFECYCLE

Bus states:

- ACTIVE
- MAINTENANCE
- RETIRED

ACTIVE:
- may schedule future Trips.

MAINTENANCE:
- cannot schedule new Trips;
- may return ACTIVE.

RETIRED:
- terminal in current product;
- soft deleted;
- cannot schedule Trips.

If ACTIVE -> MAINTENANCE/RETIRED:

- future NOT_STARTED Trips are cancelled through authoritative Trip cancellation.
- BOARDING/DEPARTED Trips are not automatically cancelled merely because asset status changed.

Existing Trip capacity snapshots remain unchanged.

---

# 44. STOP / ROUTE SOFT DELETION

Stop and Route use `deletedAt`.

Active selectors exclude deleted records.

Historical TripStop snapshots remain readable.

A Stop referenced by an active Route cannot be deactivated until route topology is changed/deactivated.

Do not physically delete history merely to simplify admin CRUD.

---

# 45. LIVE LOCATION

Live bus tracking is core.

Physical GPS hardware is out of FYP scope.

The prototype must still model real telemetry architecture.

Pipeline:

```text
Simulator
  -> trusted ingestion
  -> location application use case
  -> PostgreSQL TripLocationSample
  -> commit
  -> location.changed invalidation
  -> browser refetch
  -> map
```

Future:

```text
Physical GPS device
  -> SAME trusted ingestion contract
  -> SAME application use case
  -> SAME PostgreSQL
  -> SAME map
```

---

# 46. GPS SIMULATOR

Simulator:

- runs server-side, not in every browser;
- target ~5 seconds;
- selects eligible BOARDING/DEPARTED Trip;
- uses snapshotted TripStop coordinates/current operational segment;
- produces synthetic latitude/longitude;
- calls the same ingestion use case/API as future GPS;
- never writes Prisma directly;
- never advances Trip state.

UI must display:

**Simulated GPS / Prototype**

---

# 47. LOCATION SAMPLE

`TripLocationSample` contains:

- id;
- tripId;
- latitude;
- longitude;
- recordedAt;
- receivedAt;
- source.

Source:

- SIMULATED
- GPS

DB constraints:

- latitude -90..90
- longitude -180..180

Latest location ordered primarily by recordedAt.

Retention:

**7 days**

---

# 48. WHAT LIVE LOCATION DOES AND DOES NOT DO

Does:

- show latest actual/simulated telemetry;
- show timestamp;
- show source;
- show freshness/staleness;
- help student decide whether to continue waiting or use another transport option.

Does not:

- promise exact arrival time;
- calculate ETA unless later separately approved;
- move bus icon based solely on timetable;
- alter booking;
- alter capacity;
- board passenger;
- progress Trip;
- cancel Trip.

If no telemetry:

> No live telemetry received yet.

No fake fallback coordinate.

---

# 49. REALTIME ARCHITECTURE

Socket.io is not source of truth.

Events mean:

> something changed; refetch authoritative state.

Allowed small event vocabulary includes:

- `trip.changed`
- `occupancy.changed`
- `location.changed`
- `notification.changed`

Payload contains minimal identifiers/timestamps only.

No passenger PII.

---

# 50. REALTIME AUTHORIZATION

Anonymous arbitrary `join-trip` is forbidden.

Browser first obtains short-lived signed subscription token from authenticated Next.js.

Token scopes one Trip.

Rules:

- Driver may subscribe only to assigned Trip.
- Student may subscribe only according to permitted student tracking policy.
- Admin may subscribe operationally.
- Knowing Trip UUID is not permission.

Socket server verifies:

- signature;
- expiry;
- issuer;
- audience;
- purpose;
- role;
- Trip scope.

Then server joins the signed room automatically.

---

# 51. REALTIME INTERNAL EMIT

Internal `/emit`:

- requires Bearer service secret;
- bounded JSON body;
- whitelist event names;
- validate room;
- no arbitrary global broadcast;
- reject PII-shaped payload;
- no secret in browser.

Realtime process never imports Prisma.

---

# 52. REALTIME RECOVERY

Initial page load fetches database-backed data.

On:

- event;
- reconnect;
- periodic fallback;
- manual refresh;

client refetches.

Missing Socket.io events must never produce permanent state loss.

---

# 53. BACKGROUND JOBS

Current approved scheduler responsibilities include:

- no-show reconciliation, approximately each minute;
- location retention, low frequency such as daily;
- GPS simulator tick, approximately each 5 seconds.

Cron callback itself contains no domain logic.

It calls trusted Next.js endpoints/use cases.

Removed permanently:

- device-health simulation job.

---

# 54. ANALYTICS

All metrics need a defensible numerator and denominator.

## 54.1 Seated utilization

Because seats are segment-reusable:

Do NOT use:

`Booking count / seatedCapacity`

Use:

`reserved seat-segment claims / available seated seat-segments`

For a Trip with:

- 30 seats
- 3 segments

maximum seat-segment capacity = 90.

45 occupied seat-segment claims => 50%.

## 54.2 Standing utilization

`StandingSegmentClaim count / (standingCapacity * TripSegment count)`

If standingCapacity = 0:

return 0%, never divide by zero.

## 54.3 Ridership

Boarded reserved passengers + admitted WalkInJourneys.

## 54.4 No-show rate

NO_SHOW reserved Bookings / eligible reserved outcomes.

Do not count WalkInIntent as no-show.

## 54.5 Demand

May combine clearly defined journey demand records:

- Booking;
- WaitlistEntry;
- WalkInIntent;

within bounded date/Trip scope.

Never describe a formula ambiguously.

---

# 55. DRIVER MANIFEST PRIVACY

Driver sees only operationally necessary information:

- passenger name;
- limited student identifier;
- RESERVED/WALK_IN;
- seat number if reserved;
- boarding stop;
- drop-off stop;
- boarded state;
- expected-to-alight status.

Driver does not need:

- student email;
- password;
- credit score;
- penalties;
- appeals;
- full user object.

---

# 56. NOTIFICATIONS

Core channel:

**in-app notifications only**

Examples:

- BOOKING_CONFIRMED
- DEPARTURE_REMINDER
- CANCELLED
- NO_SHOW
- WAITLIST_PROMOTED
- PENALTY_ISSUED
- APPEAL_RESOLVED
- TRIP_DELAYED

Retry-sensitive notifications use deduplication key where necessary.

Realtime notification events are best-effort after durable notification commit.

No email/SMS/push infrastructure.

---

# 57. CURRENT DATABASE MODEL

Current Architecture v2 core Prisma models:

## Identity
- User

## Fleet/topology
- Bus
- Stop
- Route
- RouteStop

## Trip
- Trip
- TripStop
- TripSegment
- TripSeat
- TripStatusHistory

## Reserved
- Booking
- ReservedSeatSegment
- WaitlistEntry

## Walk-in
- WalkInIntent
- WalkInJourney
- StandingSegmentClaim

## Penalty
- Penalty
- PenaltyAppeal

## Notification
- Notification

## Location
- TripLocationSample

Removed:
- Seat
- SeatStatus
- DeviceStatusLog
- DeviceSignal

---

# 58. CURRENT ENUMS

## UserRole
- STUDENT
- DRIVER
- ADMIN

## BusStatus
- ACTIVE
- MAINTENANCE
- RETIRED

## TripStatus
- NOT_STARTED
- BOARDING
- DEPARTED
- ARRIVED
- CANCELLED

## BookingStatus
- CONFIRMED
- CANCELLED
- COMPLETED
- NO_SHOW

## WaitlistStatus
- WAITING
- PROMOTED
- CANCELLED
- EXPIRED

## CheckInMethod
- QR
- MANUAL

## AlightingMethod
- QR
- MANUAL
- AUTO_PLANNED_STOP

## WalkInIntentStatus
- PENDING
- BOARDED
- REJECTED_FULL
- EXPIRED
- CANCELLED

## WalkInJourneyStatus
- BOARDED
- COMPLETED

## PenaltyStatus
- ACTIVE
- APPEALED
- OVERTURNED
- UPHELD

## PenaltyType
- RESERVED_NO_SHOW

## AppealStatus
- PENDING
- APPROVED
- REJECTED

## LocationSource
- SIMULATED
- GPS

---

# 59. IMPORTANT DATABASE CONSTRAINTS

Representative invariants that must remain protected:

- Stop.code unique.
- Stop latitude/longitude valid.
- RouteStop `(routeId, position)` unique.
- RouteStop `(routeId, stopId)` unique.
- Bus seatedCapacity > 0.
- Bus standingCapacity >= 0.
- Trip capacity snapshot valid.
- TripStop `(tripId, position)` unique.
- TripSegment `(tripId, position)` unique.
- TripSeat `(tripId, seatNumber)` unique.
- ReservedSeatSegment `(tripSeatId, tripSegmentId)` unique.
- ReservedSeatSegment `(bookingId, tripSegmentId)` unique.
- WalkInJourney one per WalkInIntent.
- StandingSegmentClaim `(walkInJourneyId, tripSegmentId)` unique.
- Penalty.bookingId unique.
- PenaltyAppeal.penaltyId unique.
- Notification.deduplicationKey unique when not null.
- User.creditScore CHECK 0..100.
- TripLocationSample coordinates constrained.

Same-Trip composite foreign keys are used where practical so cross-Trip seat/stop/segment mixing is rejected.

---

# 60. CONCURRENCY MODEL

PostgreSQL is the final correctness boundary.

## Reserved booking

- serialize appropriately on Trip;
- re-read state;
- insert Booking + all claims;
- unique seat/segment constraint resolves race.

## Waitlist promotion

- Trip lock;
- live availability;
- immutable queue order;
- create promoted Booking + claims atomically.

## Walk-in admission

- lock Trip;
- lock requested TripSegments in ascending order;
- re-count claims;
- insert journey + all claims atomically.

## No-show

- lock Trip/Booking/User;
- unique Penalty.bookingId;
- one deduction.

## Appeal

- lock Appeal;
- lock User credit;
- re-read final state;
- idempotent resolution.

## Scheduling

- PostgreSQL advisory locks around Bus/Driver/Route scheduling keys;
- conflict check inside transaction.

Never add Redis/distributed lock just for this FYP.

---

# 61. APPLICATION ARCHITECTURE

Architecture style:

**feature-oriented modular monolith**

Features currently/target include:

- identity
- fleet
- trips
- bookings
- walk-ins
- boarding
- penalties
- notifications
- location
- realtime
- analytics
- optional monitoring composition
- jobs/orchestration

Each feature uses only layers it needs:

- contracts
- domain
- application
- infrastructure
- ui
- public.ts
- server.ts

Do not create empty folders for symmetry.

---

# 62. LAYER RESPONSIBILITIES

## `src/app`

Transport/presentation shell.

Owns:

- URLs;
- layouts;
- loading/error;
- Route Handlers;
- portal composition.

Must not own:

- Prisma business queries;
- transactions;
- domain transitions.

## `domain`

Pure rules.

Must not import:

- React;
- Next.js;
- Prisma;
- process.env;
- network.

## `application`

Owns:

- authorization orchestration;
- use-case flow;
- transaction coordination;
- domain calls;
- DTO outputs.

## `infrastructure`

Owns:

- Prisma queries;
- persistence-specific implementation.

Must not decide business rules.

## `shared`

Only genuinely cross-feature infrastructure/value types.

Must not become a dumping ground.

---

# 63. DEPENDENCY RULES

1. App routes call feature public/server facade.
2. Client/UI cannot import Prisma.
3. Domain cannot import infrastructure.
4. Application cross-feature calls go through feature server facades.
5. Infrastructure accesses Prisma through shared DB boundary.
6. Only shared DB constructs PrismaClient.
7. Realtime process never imports Prisma.
8. `server-only` marks secret/persistence/server modules.
9. Client boundary uses `use client` only where interaction requires.
10. Production code must not deep-import another feature's internals.

Architecture tests enforce these rules.

---

# 64. MUTATION FLOW

Standard flow:

```text
Route Handler
 -> parse/validate input
 -> resolve actor
 -> call one feature use case
 -> authorize actor/resource
 -> acquire lock
 -> transaction
 -> domain transition
 -> durable notification
 -> commit
 -> best-effort realtime invalidation
 -> minimal DTO
```

Route Handler is transport only.

No raw business Prisma mutation in Route Handler.

---

# 65. READ FLOW

Server Component:

- call feature query directly;
- do not fetch the app's own HTTP endpoint.

Client Component:

- call Route Handler when browser interaction/polling is needed.

Queries:

- explicit select;
- privacy-bounded DTO;
- never return whole Prisma User by convenience.

---

# 66. ERROR MODEL

Use small typed categories:

- unauthenticated
- forbidden
- not found
- validation
- conflict
- invariant violation
- internal/unexpected

Map consistently to HTTP.

Unexpected errors:

- log server-side with request/correlation ID;
- return generic user-safe message;
- never expose stack trace/Prisma code.

UI converts domain/technical errors into understandable copy.

---

# 67. ORIGIN / CSRF SECURITY

Cookie-authenticated browser mutations:

- require matching Origin;
- use sanitized public host/protocol;
- reverse proxy must overwrite untrusted forwarded headers.

Machine-only trusted endpoints:

- do not use browser cookie origin model;
- use server service secret.

---

# 68. SECRET BOUNDARIES

Separate:

- DATABASE_URL
- JWT/session secret
- QR signing secret
- realtime service secret
- TEST_DATABASE_URL

Do not reuse JWT secret as QR/realtime secret.

Secrets never enter Client Components.

---

# 69. REALTIME SECURITY

Realtime subscription tokens:

- short-lived;
- signed;
- purpose-scoped;
- Trip-scoped;
- role-scoped.

Internal emit:

- service authenticated;
- event whitelist;
- payload bounded.

No PII through Socket.io.

---

# 70. TEST DATABASE SAFETY

Integration tests require:

- explicit TEST_DATABASE_URL;
- PostgreSQL protocol;
- database name ending `_test`;
- not equal DATABASE_URL;
- confirmation token.

No fallback to development DB.

No SQLite.

---

# 71. TEST STRATEGY

## Unit tests

For pure policies:

- journey segment derivation;
- booking eligibility;
- cancellation;
- waitlist FIFO;
- boarding policy;
- Trip lifecycle;
- credit;
- penalty lifecycle;
- location policy;
- analytics formula;
- realtime contract.

## PostgreSQL integration

For:

- constraints;
- transactions;
- concurrent booking;
- concurrent standing admission;
- no-show idempotency;
- appeal concurrency;
- scheduling conflicts;
- Trip cancellation;
- telemetry persistence.

## Architecture tests

For dependency boundaries.

## Realtime contract tests

For:

- signed subscription;
- room scope;
- event whitelist;
- PII rejection.

## Browser E2E

Current critical workflow coverage:

- student reservation;
- waitlist;
- walk-in disclaimer;
- driver boarding fallback;
- penalty/appeal;
- admin scheduling;
- simulated GPS display.

Do not duplicate every DB concurrency test in browser E2E.

---

# 72. CI EXPECTATION

CI uses:

- Node 20;
- PostgreSQL 16;
- Prisma generation;
- lint;
- typecheck;
- unit;
- architecture;
- integration;
- production build;
- browser E2E.

Phase is not considered fully verified if DB-critical changes never run against real PostgreSQL.

---

# 73. CURRENT NPM VERIFICATION CONCEPT

Current important scripts include:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:architecture`
- `npm run test:integration`
- `npm run verify`
- `npm run build`
- `npm run realtime`
- `npm run db:seed`
- `npm run test:e2e`

Legacy lint debt is reported separately and must not justify lowering Architecture v2 new-code quality.

---

# 74. FRONTEND TARGET

Final website must be coherent on:

- ~320 px mobile width;
- 375/390/430 px common phone widths;
- 1280–1440 desktop.

Do not disable zoom.

Respect reduced motion.

Do not rely on color alone.

All forms need labels.

Dialogs need keyboard/focus behavior.

No fake button.

No out-of-scope setting.

---

# 75. STUDENT UI REQUIRED SURFACES

- login;
- registration;
- journey search;
- departure selection;
- seat selection;
- Booking confirmation;
- waitlist;
- Reserved Pass;
- Walk-in Pass;
- booking/walk-in history;
- live simulated GPS;
- notifications;
- credit;
- penalties;
- appeal;
- profile/settings that actually work.

---

# 76. DRIVER UI REQUIRED SURFACES

Priority order:

1. assigned/current Trip;
2. current stop;
3. expected boarding;
4. camera scanner;
5. onboard passenger state;
6. expected alighting;
7. progress actions.

High-impact actions use explicit wording/confirmation.

No generic “Next Status” button if meaning is unclear.

---

# 77. ADMIN UI REQUIRED SURFACES

- Dashboard / summary
- Stops
- Routes
- Buses
- Trips / scheduling
- Drivers
- Live Monitoring
- Analytics
- Appeals

No device-health/sensor UI.

No fake admin features.

---

# 78. PWA CLEANUP

Final product is a normal responsive website.

Remove active:

- manifest;
- install metadata;
- PWA-only icons;
- PWA icon generators;
- install wording.

Keep:

- normal favicon;
- responsive metadata.

No service worker.

---

# 79. SETTINGS CLEANUP

Remove UI for:

- Delete Account
- Export Data
- 2FA
- fake privacy preferences

unless genuinely implemented and approved—which they currently are not.

Keep only functional settings.

---

# 80. TIMETABLE AND DELAY UX

UI should visually distinguish:

- Planned departure
- Delay information
- Current operational state
- Latest GPS timestamp

Do not present planned time as guaranteed arrival.

Suggested wording:

- `Planned departure`
- `Delayed`
- `Boarding now`
- `Departed`
- `Last simulated location: ...`

Avoid:
- `Bus will arrive exactly at ...`
- invented ETA.

---

# 81. BOOKING UX AND DELAY

If a planned 9:00 Trip is delayed to 9:30:

- Trip remains same Trip.
- Booking remains attached.
- Booking is not auto-cancelled at 9:00.
- Student is not no-show at 9:00.
- Reservation/cancellation operational cutoff depends on boarding start at that stop.
- Live GPS/current progress communicates reality.

This rule exists specifically because timetable reliability is not assumed.

---

# 82. QR BOARDING TRADE-OFF

The system acknowledges:

- QR adds a validation interaction;
- this may reduce raw boarding throughput compared with no-check boarding;
- camera/network/user errors can add delay.

Mitigations:

- camera-first UX;
- 60-second refresh;
- clear pass screen;
- manual fallback;
- simple manifest;
- error-specific scanner responses.

Do not claim QR is faster than current queue boarding unless a real study proves it.

The value is:

- guaranteed reservation validation;
- passenger record;
- capacity correctness;
- no-show evidence;
- walk-in control.

---

# 83. ADMIN ANALYTICS HONESTY

Do not present prototype analytics as university-wide official statistics.

They are based on system-recorded prototype data.

Labels should make scope clear.

Do not imply real historical TAR UMT demand was imported unless actually done.

---

# 84. DEMO DATA RULES

Demo seed should be:

- deterministic;
- relative to current demo time;
- internally consistent;
- easy to rehearse;
- based on real TAR UMT KL route names;
- explicit that schedules/passengers are demo data.

Should include scenarios demonstrating:

- adjacent seat reuse;
- overlapping conflict;
- waitlist;
- walk-in;
- one restricted-credit student;
- one penalty/appeal;
- assigned driver;
- operational GPS sample.

Do not seed impossible states.

---

# 85. DEMO ACCOUNTS

Demo accounts may use controlled role-specific addresses.

Student demo emails must satisfy `@student.tarc.edu.my`.

Driver/admin demo domains are prototype credentials and must not be presented as official TAR UMT identity standards unless verified.

Passwords are demo-only and never production recommendations.

---

# 86. SOFT DELETION AND HISTORY

Historical integrity is a core rule.

Changing:

- Stop name;
- Route topology;
- Bus capacity;

must not rewrite scheduled/historical Trip meaning.

TripStop snapshots preserve:

- stop code/name;
- coordinates;
- planned timing.

Trip capacity snapshots preserve:

- seated;
- standing.

Passenger histories are preserved even when active claims are released.

---

# 87. DATA MINIMIZATION

Student:
- own data only.

Driver:
- operational passenger fields for assigned Trip.

Admin:
- management data needed for role.

Realtime:
- no PII.

Location:
- Trip coordinates/source/time, not passenger location.

No passenger GPS tracking.

---

# 88. LOCATION PRIVACY / SCOPE

GPS represents the **bus**, not the student.

Never:

- request student's continuous location for this feature;
- store student GPS;
- infer passenger location from phone.

From/To selections are journey intent, not live personal tracking.

---

# 89. APP ROUTER TARGET STRUCTURE

Architecture v2 supports a coherent App Router at either root `app/` or `src/app/`. Phase 9 retained root `app/` to avoid a risky mechanical move with no product benefit. Feature and shared implementation remain under:

```text
src/
  features/
  shared/
```

Configuration/migrations/runtime remain top level:

```text
prisma/
realtime/
framework/
tests/
public/
```

The active route tree is root `app/`; there is no duplicate `src/app/` route tree. A later move is optional and must remain coherent.

---

# 90. FEATURE OWNERSHIP SUMMARY

## identity
Auth/session/current user/driver account admin.

## fleet
Stops/Routes/Buses/asset lifecycle.

## trips
Scheduling/snapshot/progress/status/cancellation/assignment.

## bookings
Reserved Booking/availability/ReservedSeatSegment/waitlist.

## walk-ins
WalkInIntent/WalkInJourney/standing admission.

## boarding
Pass contracts/QR/manual boarding/alighting/manifest orchestration.

## penalties
No-show/credit/restriction/Penalty/Appeal.

## notifications
In-app notification creation/list/read.

## location
Telemetry ingestion/latest/retention/simulator policy.

## realtime
Subscription authorization/contracts.

## analytics
Read-only bounded metrics.

---

# 91. API CAPABILITY MAP

Exact URL may evolve, but capability ownership is fixed.

## Auth
- register
- login
- logout
- current user
- password change

## Journey
- compatible From/To search
- list matching departures
- journey availability

## Booking
- create
- mine/history
- cancel
- Reserved Pass

## Waitlist
- join
- list own
- cancel if supported
- promotion internal

## Walk-in
- create intent
- list own
- Walk-in Pass

## Boarding
- scan pass
- manual boarding
- manifest
- alight
- progress

## Fleet/admin
- Stops CRUD
- Routes CRUD
- Buses CRUD/status
- Drivers
- Trips schedule/update/cancel

## Penalty
- mine
- appeal
- admin appeal list/resolve

## Location
- ingest trusted
- simulate trusted
- latest Trip location
- retention job

## Realtime
- issue subscription token
- internal emit bridge

## Analytics
- utilization
- no-show rate
- demand/ridership as approved

---

# 92. STATE MACHINE QUICK REFERENCE

```text
TRIP
NOT_STARTED -> BOARDING -> DEPARTED -> ARRIVED
      \            \            \
       -------------> CANCELLED
ARRIVED/CANCELLED terminal
```

```text
BOOKING
CONFIRMED -> CANCELLED
CONFIRMED -> NO_SHOW
CONFIRMED + checkedInAt -> COMPLETED
```

```text
WAITLIST
WAITING -> PROMOTED
WAITING -> CANCELLED
WAITING -> EXPIRED
```

```text
WALK-IN INTENT
PENDING -> BOARDED
PENDING -> REJECTED_FULL
PENDING -> CANCELLED
PENDING -> EXPIRED
```

```text
WALK-IN JOURNEY
BOARDED -> COMPLETED
```

```text
PENALTY
ACTIVE -> APPEALED -> OVERTURNED
                   -> UPHELD
```

```text
APPEAL
PENDING -> APPROVED
        -> REJECTED
```

---

# 93. FINAL OPERATING POLICY TABLE

| Policy | Final rule |
|---|---|
| Booking opens | 7 days before planned boarding-stop departure |
| Booking closes | **When operational boarding begins at passenger boarding stop** |
| Reserved cancellation closes | **When operational boarding begins at passenger boarding stop** |
| Normal QR/boarding window | 15 min before planned stop departure; delay/progress may extend |
| Boarding definitely closed | boarding stop has departed/passed |
| QR lifetime | 60 seconds |
| Initial credit | 100 |
| No-show deduction | up to 15, bounded by zero |
| Booking restricted | credit < 40 |
| GPS simulator | ~5 seconds |
| Location retention | 7 days |
| Waitlist | oldest-compatible-first FIFO |
| Walk-in capacity | checked only at successful scan |
| No-show evidence | actual departure/passed at passenger's boarding stop |
| Exit QR | optional operational evidence |
| Physical seat labels | required proposed deployment change for reserved seats |
| Walk-in temporary seating | allowed operationally if free, no reserved entitlement |

---

# 94. SUPERSEDED OLD POLICY

The following old rule is superseded:

> reserved cancellation closes 30 minutes before scheduled boarding-stop departure.

The following historical Phase 8 implementation behavior is also superseded and was removed in Phase 9.5:

> reservation is TOO_LATE merely because `now >= boardingPlannedDeparture`.

Reason:

Published timetable is not treated as reliable operational truth under significant traffic delay.

Phase 9.5 corrected the code without weakening the established booking invariants.

Expected affected areas:

- product policy config;
- reservation-policy domain code;
- booking use case;
- waitlist join/promotion eligibility where needed;
- UI copy;
- unit tests;
- PostgreSQL/browser E2E acceptance scenarios;
- APP_SPECIFICATION source-of-truth documentation.

Do not silently keep `reservedCancellationLeadMs = 30 minutes` as final product policy.

---

# 95. IMPLEMENTATION STATUS SNAPSHOT — 2026-08-21

## Completed and remotely verified

### Phase 0
Requirement alignment.

### Phase 1
Verification safety net and architecture guards.

### Phase 2
Shared server foundation.

### Phase 3
Directional topology and per-Trip inventory.

### Phase 4
Reserved journeys and journey-aware waitlist.

### Phase 5
Passes, boarding, walk-in, alighting, Trip progress.

### Phase 6
No-show, credit, penalties, appeals, reconciliation.

### Phase 7
Fleet, scheduling, driver assignment, admin operations.

### Phase 8
GPS telemetry, realtime hardening, Seat/device removal, analytics.

### Phase 9
Frontend composition, responsive UX, accessibility, PWA/settings cleanup, and browser E2E completed and remotely verified.

### Phase 9.5
Canonical product alignment, operational booking/cancellation cutoffs, and mutation-based browser E2E closure completed and remotely verified.

## Not yet started

### Phase 10
Final documentation, deterministic demo rehearsal, ERD/runtime diagrams, report/viva evidence, citation verification, merge readiness.

## Incorporated owner-approved correction after Phase 9

The operational booking/cancellation cutoff described in Sections 22–24 and 94 is implemented and protected by unit, PostgreSQL integration, and browser acceptance tests.

---

# 96. IMPLEMENTATION DISCIPLINE FOR AI CODING AGENTS

Before modifying code:

1. Read this specification.
2. Read AGENTS.md.
3. Read relevant Architecture document.
4. Read relevant Phase report.
5. Read current feature code and tests.
6. Check whether requested behavior is current, proposed, or explicitly out of scope.
7. Identify transaction and authorization boundary.
8. Preserve PostgreSQL invariants.
9. Add/adjust tests before claiming completion.
10. Commit, push, and observe CI when phase/task requires.

Never implement from a single user sentence without reconciling it with this spec.

---

# 97. RULES AN AI MUST NOT INVENT

Do not invent:

- official TAR UMT route names;
- exact other-campus operations;
- official student-number regex;
- official driver email domain;
- payment;
- seat sensors;
- physical GPS;
- ETA algorithm;
- student GPS tracking;
- admin spreadsheet usage;
- an exact boarding throughput improvement;
- university deployment approval;
- mandatory QR exit;
- Walk-in seat guarantee;
- whole-trip seat status;
- multi-route transfer;
- circular route;
- PWA;
- hidden enterprise architecture.

If a new requirement needs any of the above, ask first.

---

# 98. BUSINESS INVARIANTS THAT MUST NEVER BE BROKEN

1. Same reserved TripSeat may be reused on non-overlapping segments.
2. Same reserved TripSeat cannot overlap on one segment.
3. One A->C reservation needs one same seat across A-B and B-C.
4. WalkInIntent consumes zero capacity.
5. Walk-in admitted only if every requested segment has standing capacity.
6. Concurrent final standing-place scans cannot over-admit.
7. Token claims never replace database validation.
8. Driver cannot operate unassigned Trip.
9. No-show requires actual boarding-stop departure/passed evidence.
10. Walk-in never gets reserved no-show penalty.
11. One Penalty per reserved Booking.
12. Appeal approval restores recorded deduction once.
13. Route/Bus edits never rewrite historical Trip snapshots.
14. Realtime never owns durable state.
15. GPS never progresses/cancels/boards a Trip.
16. Seat/device legacy model must not return.
17. Cancellation of Trip does not promote waitlist.
18. Delayed planned time does not itself create no-show.
19. Final booking/cancellation closes on operational boarding start, not fixed scheduled cutoff.
20. Walk-in temporary physical seating never becomes reserved entitlement.

---

# 99. FYP DEFENCE / VIVA POSITIONING

The strongest defendable technical contributions are:

## 99.1 Segment-aware seat allocation

Traditional simplistic student projects often lock a seat for a whole Trip.

This project models passenger intervals.

Database segment claims permit safe adjacent reuse.

## 99.2 PostgreSQL concurrency correctness

Critical capacity rules are not only UI checks.

They are protected with:

- transactions;
- locks;
- uniqueness;
- checks;
- integration concurrency tests.

## 99.3 Reserved vs Walk-in semantic separation

Reservation guarantees seat.

Walk-in guarantees nothing until scan.

This distinction is explicit in model, QR purpose, UI, and capacity transaction.

## 99.4 Operational delay correctness

The system does not assume timetable equals reality.

No-show and final booking/cancellation cutoffs use actual operational progress.

## 99.5 Source-neutral GPS architecture

Simulator behaves as fake device input to the real ingestion boundary.

A future GPS source can replace it without rewriting map/domain.

## 99.6 Retry-safe penalty/appeal workflows

Repeated jobs and concurrent admin actions do not double deduct/restore.

## 99.7 Historical snapshot integrity

Route and Bus edits do not mutate the meaning of past Trips.

---

# 100. PRODUCT LIMITATIONS TO STATE HONESTLY

The prototype has trade-offs.

## QR boarding overhead

Scanning can be slower than simply walking onto a bus.

The FYP prioritizes reservation validation/accountability.

Actual production deployment should pilot-test boarding throughput.

## GPS hardware

No physical GPS is deployed.

Telemetry is simulated and labelled.

## Timetable

The app cannot make traffic disappear.

It provides visibility, not punctuality.

## Seat labels

Current observed buses are not passenger-selectable numbered-seat systems.

Physical labels are a proposed operational deployment requirement.

## Other campuses

KL context is primary.

Other campus workflows have not been validated.

## Real institutional identity

TAR UMT SSO integration is not part of prototype.

---

# 101. FINAL ACCEPTANCE CRITERIA

A final system is acceptable only when all of the following are true.

## Student

- Can register/login.
- Can search From->To->Date->Departure.
- Can see journey-specific seats.
- Can reserve non-overlapping segment-reusable seat.
- Cannot create overlapping seat claim.
- Can cancel before operational boarding begins.
- Cannot cancel once boarding has begun.
- Can join waitlist when no full-journey seat exists.
- Can generate Reserved QR.
- Can generate non-guaranteed Walk-in QR.
- Can view simulated live location.
- Can see history/notifications/credit/penalty/appeal.

## Driver

- Can view assigned Trip only.
- Can scan Reserved.
- Can scan Walk-in.
- Cannot over-admit standing.
- Can use manual fallback.
- Can progress stops.
- Can record alighting.
- Cannot operate another Driver's Trip.

## Admin

- Can manage real demo Stop/Route templates.
- Can manage Bus capacity/status.
- Can manage Driver accounts.
- Can schedule conflict-free Trip.
- Can cancel Trip consistently.
- Can see truthful operational counts.
- Can review appeal.
- Can view analytics.
- No seat-sensor/device UI remains.

## GPS/realtime

- Telemetry persists.
- UI says simulated/prototype.
- No schedule interpolation fallback.
- Realtime subscription authenticated.
- Missed socket event recoverable by refetch.

## Engineering

- No SQLite.
- Clean PostgreSQL migration path.
- New code zero-warning lint.
- Typecheck passes.
- Unit passes.
- Architecture tests pass.
- PostgreSQL integration passes.
- Production build passes.
- Browser E2E covers critical paths by final Phase 9/10.
- Fresh clone setup is repeatable by final Phase 10.

---

# 102. FINAL ONE-PARAGRAPH SYSTEM DESCRIPTION

The TAR UMT Kuala Lumpur Campus Shuttle Management System is a responsive, PostgreSQL-backed web prototype for free campus shuttle operations. Students search a directional journey using From, To, Date and Departure, then reserve a numbered seat that is guaranteed only across the segments they actually travel; the same physical seat can therefore be safely reused by another passenger on non-overlapping parts of the same Trip. Students who do not reserve may request a non-guaranteed Walk-in Pass, whose standing capacity is checked atomically only when the assigned driver scans it. Drivers validate short-lived Reserved, Walk-in and Alighting QR passes, use manual fallbacks, manage actual stop progress and view a privacy-limited passenger manifest. No-show penalties depend on actual departure from the passenger's boarding stop rather than timetable time, making the system tolerant of real traffic delays; credit and appeal workflows are retry- and concurrency-safe. Administrators manage directional Stops/Routes, buses, drivers, Trip scheduling and cancellations, while analytics use segment-weighted capacity rather than misleading whole-trip seat counts. Live bus tracking uses persisted simulated GPS telemetry through the same authenticated ingestion boundary a future physical GPS device could use, with Socket.io carrying only authenticated invalidation events while PostgreSQL remains the durable source of truth.

---

# 103. FINAL AI HANDOFF SUMMARY

If you are a new AI agent and remember only ten things, remember these:

1. **Current TAR UMT KL does not have the proposed reservation system; do not describe no-show as an existing current problem.**
2. **Traffic makes planned times unreliable; operational progress is stronger than clock time.**
3. **A Trip is one scheduled service run; delay does not create a new Trip.**
4. **Reserved seating is segment-aware using TripSeat + ReservedSeatSegment.**
5. **WalkInIntent reserves nothing; successful scan creates standing claims.**
6. **PostgreSQL transactions/constraints are final capacity truth.**
7. **No-show happens only after actual boarding-stop departure/passed evidence.**
8. **Final booking and cancellation cutoff is operational boarding start, not the old 30-minute scheduled rule.**
9. **GPS is simulated but enters through a real source-neutral backend telemetry pipeline; never fake location in the browser.**
10. **Keep the architecture FYP-sized: modular monolith + small realtime process, no unnecessary enterprise infrastructure.**

---

# 104. DOCUMENT MAINTENANCE RULE

Whenever an owner-approved product decision changes:

1. update this specification first;
2. identify affected feature/domain/API/UI/test/config;
3. add an implementation task;
4. keep old Phase reports historical;
5. update code and tests;
6. run verification;
7. commit/push;
8. do not edit history to pretend the old behavior never existed.

This prevents code, proposal, report, and AI agents from drifting into different versions of the product.
