# Final Concurrency Evidence

PostgreSQL is the final correctness boundary. These are small, explainable
transaction strategies for the FYP—not a generic distributed-lock platform.

## Reserved journeys

Reservation mutations lock the Trip row with `FOR UPDATE`, reread the immutable
journey and live claims, and create the Booking plus every traversed
ReservedSeatSegment in one transaction. One TripSeat must be free across the
complete journey. PostgreSQL uniqueness on
`(tripSeatId, tripSegmentId)` makes overlapping allocation impossible even when
two requests race; adjacent, non-overlapping journeys may reuse the seat.

Evidence: `src/features/bookings/infrastructure/booking.prisma.server.ts` and
`tests/integration/phase4-reserved-journeys.test.ts`.

## Walk-in standing admission

Pass issuance creates no capacity claim. Admission locks the Trip and requested
TripSegments in stable position order, recounts StandingSegmentClaims for every
segment, and creates one WalkInJourney plus all claims atomically only if every
segment fits the Trip standing-capacity snapshot. This prevents two concurrent
final-space scans from over-admitting.

Evidence: `src/features/boarding/infrastructure/boarding.prisma.server.ts`,
`src/features/walk-ins/infrastructure/walk-in.prisma.server.ts`, and
`tests/integration/phase5-boarding-and-walkin.test.ts`.

## No-show and appeal idempotency

No-show handling locks Trip/Booking/User, rechecks operational progress, changes
the Booking once, releases claims, and creates penalty/credit/notification state
in one durable transaction. Unique `Penalty.bookingId` prevents duplicate
deductions under retry. Appeal resolution locks the appeal and user, accepts
only PENDING state, and restores the points recorded on the Penalty once, capped
at 100.

Evidence: `src/features/penalties/infrastructure/penalty.prisma.server.ts` and
`tests/integration/phase6-no-show-and-penalties.test.ts`.

## Scheduling

Trip scheduling takes PostgreSQL transaction-scoped advisory locks for concrete
Bus, Driver and Route scheduling keys, then checks interval overlap inside the
same transaction before snapshot creation. This prevents concurrent schedules
from assigning one Bus or Driver to overlapping non-cancelled Trips.

Evidence: `src/features/trips/infrastructure/trip.prisma.server.ts`,
`src/features/fleet/infrastructure/fleet.prisma.server.ts`, and
`tests/integration/phase7-fleet-and-admin.test.ts`.

## Round 1 concurrency stabilization

Schedule writers acquire transaction-scoped advisory locks in Route, Bus,
ServiceBlock, and Driver order, with stable ID order within each group. Single
and bulk creation acquire the complete set before validation and writes.
Schedule edits use immutable Bus and ServiceBlock keys and resolve the current
assignment while holding the Bus lock. They then acquire the Trip row lock,
re-read operational and passenger state, validate, and mutate. Fleet updates
acquire the Bus key before affected Trip rows. Resequencing holds the Bus and
ServiceBlock keys. Passenger operations do not take scheduling advisory locks.

Reservations and cancellation, waitlist entry creation and cancellation,
walk-in issuance and admission, operator progress and alighting, and no-show
handling serialize on the Trip row. A cancellation rechecks WAITING under
that lock. Walk-in admission takes segment claims in stop order. No-show
deductions lock Student credit in stable Student order across Trips. Appeal
resolution serializes on the Appeal row and then the affected credit row.

A dedicated PostgreSQL transaction held the Bus advisory lock, and the tests
observed the waiting editor through `pg_blocking_pids`. Before the change,
reservation, walk-in issuance, and driver progress each committed while the
editor was waiting, and all three edits still succeeded on a stale read.
After the change each edit rejects. The opposite interleaving holds a TripStop
row to suspend an editor already holding the Trip row, then observes a waiting
reservation. The reservation evaluates the changed departure. Other tests
exercise single and bulk creation on one ServiceBlock alongside editing and
waitlist cancellation ahead of capacity release.
