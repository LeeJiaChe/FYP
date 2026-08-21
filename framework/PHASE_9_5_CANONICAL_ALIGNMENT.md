# Phase 9.5 — Canonical Product Alignment and Browser E2E Closure

**Date:** 2026-08-21  
**Status:** Implemented; verification evidence is recorded below.  
**Scope:** Product-source reconciliation, operational reservation timing, and mutation-based browser acceptance closure only.

## Canonical product source

`framework/APP_SPECIFICATION.md` is now version 3.1 and the highest detailed
product source of truth. It preserves four explicit fact classes:

1. owner-observed TAR UMT KL current reality;
2. publicly verifiable university information;
3. unknown university internals that must not be invented;
4. behavior proposed by this FYP.

The supplied version 3 draft was reconciled rather than copied blindly:
repository identity is `LeeJiaChe/FYP`, Phase 9 is complete, Playwright is
implemented, root `app/` is the deliberate current App Router location, and
the Phase 9.5 correction is reflected as implemented.

## Operational reservation boundary

Planned timetable remains authoritative for Trip identity, advance search,
display, and the opening boundary. Reservation opens using the central
`bookingOpenLeadMs`, measured from the passenger's planned boarding-stop
departure.

Reservation and cancellation no longer close from planned clock time. Both
close when operational boarding begins at that passenger's stop:
`actualArrival`, `actualDeparture`, or `passedAt` is present. A Trip may
already be `DEPARTED` from an earlier stop while a later-stop journey remains
bookable. Only `ARRIVED` and `CANCELLED` are categorically non-bookable.

The obsolete `reservedCancellationLeadMs` field and default were removed.
There is no replacement minute-based cutoff.

Waitlist promotion uses the same actual-arrival boundary while preserving
oldest-compatible-first FIFO and immutable skipped-entry priority.

Boarding-window and no-show policies were not changed.

## Browser acceptance closure

The deterministic seed supplies preconditions but the critical mutations occur
through browser-visible UI:

- create reserved Booking and open Reserved Pass;
- join a full-journey waitlist;
- generate Walk-in intent/pass and display the non-guarantee warning;
- start boarding and manually board a reserved passenger;
- submit an appeal, approve it as Admin, and observe restored credit;
- schedule a Trip and observe route, Bus, Driver, and capacity snapshot;
- display persisted telemetry as `Simulated GPS / Prototype`.

CI does not require webcam hardware. Camera UI remains primary; the explicitly
labelled development/demo fallback remains available for deterministic scans.

## Schema and migration

No Prisma schema field, enum, relation, constraint, or migration changed in
Phase 9.5.

## Verification

Required gates:

- scoped lint;
- typecheck;
- 23 unit/specification files;
- architecture tests;
- PostgreSQL integration tests including six new operational-timing cases;
- Playwright desktop/mobile tests;
- Prisma validation;
- production build;
- `git diff --check`;
- stale-reference audit.

The final GitHub Actions run and counts are recorded in the Phase 9.5 handoff.

## Phase 10 boundary

Phase 10 remains limited to final documentation/citation verification,
repeatable setup validation, diagrams, demo rehearsal, viva evidence, and merge
readiness. None of that work began in Phase 9.5.
