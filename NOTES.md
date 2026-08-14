# Approved Product and Architecture Decisions

Status: Phase 0 decisions and pre-Phase-1 owner amendments aligned on 2026-08-14.

`framework/APP_SPECIFICATION.md` is the product source of truth. The target
technical design is `framework/ARCHITECTURE.md`; migration impact and remaining
questions are in `framework/ARCHITECTURE_AUDIT_2026-08-14.md`. These notes are a
short decision index, not evidence that the current implementation is complete.

1. **Database:** PostgreSQL with Prisma is intentional. Evolve it only through
   forward migrations; never revert to SQLite or edit the applied initial
   migration.

2. **Product form:** The product is a responsive website for mobile and desktop
   browsers, not a PWA or native application. Installability, manifest behavior,
   service workers, offline caching, install prompts, and PWA-specific icons are
   removed from scope. Existing artifacts remain temporarily for later deletion.

3. **Architecture:** Continue with a feature-oriented modular monolith in the
   Next.js App Router, a small standalone Socket.io process, and PostgreSQL as the
   durable source of truth. Realtime never owns durable business state.

4. **Routes:** A Route is one directional ordered list of approximately two to
   five distinct Stops. Reverse travel is another Route. Circular routes,
   transfers, and multi-route journeys are out of scope.

5. **Student search:** The conceptual flow is
   `From -> To -> Date -> Departure -> Seat`. The server finds directional Routes
   where From occurs before To. “Segment” is internal domain terminology, not a
   required student-facing wizard step.

6. **Reserved seating:** A Booking persists boarding and drop-off TripStops and
   guarantees a specific TripSeat over every traversed TripSegment. The same seat
   may be reused by non-overlapping journeys. A scalar whole-trip `Seat.status`
   cannot represent target availability.

7. **Waitlist:** A WaitlistEntry is separate from a guaranteed Booking and stores
   the exact requested journey. A passenger joins only if no single seat is free
   across the complete journey. Promotion must re-evaluate and claim all required
   segments atomically.

8. **Bus capacity:** Every Bus has independently configurable seated and standing
   capacities. A Trip snapshots both values so later fleet edits do not rewrite
   scheduled/historical capacity.

9. **Walk-in standing:** A WalkInIntent/Pass records student, Trip, boarding stop,
   and drop-off stop but consumes no capacity and guarantees no admission. At
   scan time, the assigned driver workflow locks every traversed TripSegment and
   atomically creates the admitted WalkInJourney/standing claims only when all
   segments have capacity. Admission is first-come-first-served at transaction
   commit.

10. **Pass types:** Reserved Pass, Walk-in Pass, and Exit/alighting purpose are
    explicit token contracts. Reserved and walk-in boarding share security and
    transport helpers but do not share a confusing persistence invariant.

11. **Alighting:** Planned drop-off is always stored. Exit QR and driver manual
    confirmation are useful evidence; a retry-safe automatic completion may run
    after the Trip passes the planned stop. Missing an exit scan never blocks
    capacity because planned segments are authoritative.

12. **Location:** Live bus location remains core. The FYP uses a GPS simulator
    that submits realistic coordinates through the same authenticated ingestion
    contract a future physical GPS adapter would use. The UI must label simulator
    data and must not present schedule interpolation as GPS.

13. **Seat devices:** Seat sensors, `DeviceStatusLog`, `DeviceSignal`, device-
    health simulation, device-health cron, and sensor dashboards are removed from
    approved scope. Existing schema/code/UI/tests are scheduled for controlled
    deletion; they are not deleted in Phase 0.

14. **No payment:** The shuttle is free. Do not add fares, prices, payments,
    refunds, gateways, or paid-ticket concepts.

15. **Jobs and realtime:** Approved scheduled work includes no-shows, reminders,
    waitlist evaluation, and optional automatic alighting. The realtime process
    publishes authenticated non-PII invalidations for occupancy, Trip state, and
    location. It does not access Prisma.

16. **Current implementation status:** Current JSON stops, discarded From/To
    selection, whole-trip Seat status, combined Booking/waitlist state, absent
    standing flow, schedule-interpolated map, PWA artifacts, and device-health
    feature are prototype behavior—not approved target behavior.

17. **Waitlist order:** Promotion is oldest-compatible-first FIFO. A temporarily
    incompatible entry may be skipped but keeps its original priority.

18. **Trip state:** Lifecycle is `NOT_STARTED -> BOARDING -> DEPARTED -> ARRIVED`,
    with irreversible `ARRIVED`/`CANCELLED` terminals. Delay is metadata. A future
    post-departure emergency cancellation requires a reason and TripStatusHistory.

19. **Central policy:** Defaults are booking 7 days ahead, cancellation 30 minutes
    before the boarding stop, boarding from 15 minutes before through 5 minutes
    after that stop unless delayed, QR lifetime 60 seconds, initial credit 100,
    no-show penalty 15, restriction below 40, GPS interval 5 seconds, and location
    retention 7 days. One validated configuration module owns these values.

20. **Identity and scanning:** Student email is trim/lowercase and limited to
    `@student.tarc.edu.my` without an invented local-part regex; student ID is
    trim/uppercase. Camera QR scanning is required; paste is dev/demo fallback.

21. **Scheduling and scope:** RouteStops store travel duration to the next stop;
    TripStop times derive from the origin departure and offsets. Account deletion
    and export are out of scope. Citation verification is a final defence task.

22. **Walk-in and migration:** Walk-in intent may be issued regardless of reserved
    availability, but is redundant beside the same student's confirmed Booking
    for the same Trip/journey. No non-demo legacy data must survive; the
    development database may be reset and reseeded in the approved migration.
