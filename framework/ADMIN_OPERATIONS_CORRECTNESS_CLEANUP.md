# Admin Operations Correctness Cleanup

**Date:** 2026-09-04
**Schema impact:** None

## Live Operations

Admin Live Operations derives eligibility from authoritative `Trip.status`.
Only `BOARDING` and `DEPARTED` Trips are selectable. The monitored Trip resolver
preserves an eligible explicit selection, otherwise chooses the first active
Trip, and returns no selection when none remain. A `trip.changed` invalidation
refreshes both the monitoring detail and the Trip list so an `ARRIVED` or
`CANCELLED` selection moves to another active Trip or clears automatically.

The empty state does not create or imply activity:
`No active shuttle operations right now.`

## Bus operational context

The Bus table remains fleet inventory. Its read-only Current / Next Assignment
column is derived in memory from the Admin Trip-list projection already fetched
for the portal:

- Current is the Bus's sole `BOARDING` or `DEPARTED` Trip.
- Next is its earliest `NOT_STARTED` Trip whose planned departure is not before
  the current time.
- Service Line, direction, Route and Driver come from the existing
  `Trip -> Route -> ServiceLine` and `Trip -> Driver` projection.
- Multiple active Trips produce an explicit attention state; the UI does not
  choose one record as arbitrary durable Bus state.

This adds no Bus assignment field and no per-Bus query. `Trip.busId`,
`Trip.routeId` and `Trip.driverId` remain the assignment source of truth.

## Trip-count wording

The existing Bus query uses Prisma `_count: { trips: true }` without a status or
time filter, so it counts the Bus's complete historical Trip relation. The UI
therefore labels the value **Total Trips**, not **Scheduled Trips**. The query is
intentionally unchanged because an all-time count is useful and the minimal
correction is to describe it accurately.

## Repository hygiene

Removed `scratch/fix_admin.py`, `scratch/fix_student.py`,
`scratch/fix_tier2.py`, and `split_trips.py`. The architecture audit already
classifies them as already-applied regex mutation scripts. They hard-code old
paths and superseded fields or policies, have no package-script consumer, and
could damage current source if rerun. Registered test runners, verification
scripts, migrations, documentation and reusable tooling remain intact.
