# Phase 6 — No-show, Credit, Restriction, Penalty, Appeal, and Reconciliation

Status: **Implemented on `architecture-v2`; GPS/Phase 7 not started**

Date: 2026-08-15

## Scope delivered

Phase 6 replaces the legacy wall-clock cron and duplicated appeal mutations with
one Architecture v2 penalties feature. It covers reserved no-show detection,
allocation release, waitlist promotion, bounded credit, derived booking
restriction, penalty/appeal lifecycles, durable notifications, and a retry-safe
reconciliation entry point. It does not implement GPS telemetry, penalize
walk-in passengers, or remove the later-scope Seat/device/PWA code.

## Authoritative no-show definition

A Booking is a no-show only when it is `CONFIRMED`, `checkedInAt` is null, and
its own boarding `TripStop` has `actualDeparture` or `passedAt` evidence. Planned
time and the Trip-origin deadline are not sufficient. A delayed bus still
boarding at that stop therefore cannot create a false no-show. A boarded
reserved passenger cannot transition to no-show, and `WalkInIntent` and
`WalkInJourney` never enter this policy.

Driver `DEPART_CURRENT_STOP` progress records the stop departure/passed evidence,
auto-completes planned alighting, and invokes the same no-show operation inside
the progress transaction. The trusted reconciliation job selects only progressed
TripStops that still have confirmed, unchecked candidates and invokes that same
operation. It is a recovery path, not a second definition.

## Transaction and idempotency strategy

The owning application boundary is `penalties`. For direct reconciliation it
starts a PostgreSQL transaction and locks the Trip row. Trip progress already
holds that lock and calls the transaction-aware entry point. Within the one
transaction, each candidate Booking is locked and re-read before the service:

1. changes the Booking to `NO_SHOW`;
2. deletes its active `ReservedSeatSegment` claims;
3. locks the current User credit row;
4. creates one `RESERVED_NO_SHOW` Penalty;
5. applies the bounded credit deduction;
6. writes one deduplicated `PENALTY_ISSUED` notification; and
7. runs the Phase 4 oldest-compatible-first promotion operation after all
   releases.

`Penalty.bookingId` is unique in PostgreSQL, while the Trip and Booking locks
serialize concurrent retry attempts. Notification deduplication keys provide a
second durable retry boundary. The transaction either commits the state,
allocation, penalty, credit, notification, and promotions together or commits
none of them. Realtime invalidation occurs only after commit and is best effort.

Promotion re-reads every waiter in original FIFO order. A waiter whose boarding
TripStop has departed/passed, whose Trip is terminal, whose credit is restricted,
or whose complete journey does not fit is skipped without losing `queuedAt`.
Future-stop compatible passengers may therefore be promoted after an origin
no-show releases later segments.

## Credit and restriction source of truth

`User.creditScore` is the only durable source of truth. PostgreSQL constrains it
to `0..100`. The configured initial maximum is 100, a reserved no-show deducts
up to 15 points without going below zero, and an approved appeal restores the
exact `Penalty.creditPointsDeducted` without exceeding 100.

Booking restriction is derived everywhere as `creditScore < 40`; the redundant
`User.isBookingRestricted` column is removed. Credit 40 is eligible and credit
39 is restricted. Compatibility API/UI DTOs may still expose a derived
`isBookingRestricted` value, but no independent boolean is persisted.

## Penalty and appeal lifecycle

`Penalty.type` is `RESERVED_NO_SHOW`. A Penalty stores the unique Booking,
student, actual points deducted, reason, status, and creation time. Booking and
student deletion are restricted to preserve evidence.

```text
Penalty: ACTIVE -> APPEALED -> OVERTURNED | UPHELD
Appeal:  PENDING -> APPROVED | REJECTED
```

Only the owning student may submit one bounded, non-empty appeal for an `ACTIVE`
Penalty. Submission atomically creates the pending `PenaltyAppeal` and moves the
Penalty to `APPEALED`; credit does not change.

Only an ADMIN may resolve a pending appeal. Resolution locks and re-reads the
Appeal and current User credit in one transaction. Approval restores the points
recorded by that Penalty, marks `OVERTURNED`, and writes one durable
`APPEAL_RESOLVED` notification. Rejection restores nothing and marks `UPHELD`.
Concurrent or repeated resolutions return the already-final result and cannot
restore points or notify twice. Admin list DTOs expose only name, student ID,
penalty/journey context, appeal text, and review state—not email or full User
records.

## Reconciliation and trusted-service boundary

`POST /api/admin/cron/no-show` is now a thin Route Handler. It validates the
trusted service secret using the centralized server environment, then invokes
the shared reconciliation use case. The scan is bounded to 100 progressed stop
candidates per run and uses actual progress rather than elapsed planned time.
Repeated and concurrent invocations are safe under the database guarantees.

## Migration

Forward migration `20260816010000_phase_6_no_show_and_penalties`:

- adds `PenaltyType.RESERVED_NO_SHOW`;
- makes `Penalty.bookingId` unique;
- adds the `User.creditScore` range CHECK;
- adds nullable unique notification deduplication keys;
- replaces cascade deletion of penalty/appeal evidence with `RESTRICT`;
- adds penalty, appeal, and reconciliation-aligned indexes;
- removes redundant `User.isBookingRestricted`; and
- removes obsolete `Booking.qrTokenIssuedAt` after the Phase 5 dynamic-pass
  migration.

Earlier migrations remain unchanged. The migration refuses invalid credit or
duplicate Booking penalties with a clear message. The approved development
reset/reseed remains available for non-authoritative demo data but is not
unconditionally required by this migration.

## UI and legacy boundary

Student penalty views show current credit, the configured restriction threshold,
penalty/journey context, appeal submission, and result. Admin appeal review shows
only operationally necessary identity and journey fields. The legacy direct
Prisma no-show cron and appeal routes are replaced with thin handlers; there is
one no-show and one appeal-resolution implementation.

`Seat.status` remains temporary for later admin/device cleanup and is never read
or written as no-show, penalty, or reservation capacity truth. The existing
analytics endpoint continues to read authoritative `Booking.status = NO_SHOW`.
Full Seat/device/PWA cleanup remains later scope.

## Verification evidence

The Phase 6 unit suite exercises actual-progress eligibility, boarded/delayed
exclusion, configured deduction/restoration clamps, the exact 40/39 restriction
boundary, and penalty/appeal transitions. The PostgreSQL 16 suite adds grouped
scenarios for progress-triggered no-show, walk-in exclusion, concurrent/repeated
idempotency, credit constraints, claim release and future-stop waitlist
promotion, database penalty uniqueness, retry-safe reconciliation, appeal
ownership/duplication, concurrent approval, exact/capped restoration, rejection,
and durable notification deduplication.

Local PostgreSQL is unavailable in the workspace, so the fail-closed integration
runner correctly refuses to execute without `TEST_DATABASE_URL`. Local checks
pass Prisma validation, Architecture v2 lint, strict typecheck, all 17
unit/specification files, the dependency-policy scan, and whitespace validation.
The local Next production build reaches Turbopack but is environment-blocked
because the sandbox forbids the CSS worker from binding a port.

GitHub Actions run `31857340625` completed successfully for implementation commit
`4ef8362b417a7c050362912dd784046dddf57e33`. Its clean PostgreSQL 16 service
applied the complete forward migration history and passed all 43 integration
scenarios, including the 12 Phase 6 scenarios above. The same run passed Prisma
generation, Architecture v2 lint, strict typecheck, all unit/specification files,
the dependency-policy scan, and the production build.

## Remaining boundary

Phase 6 stops here. GPS telemetry remains unimplemented. Later work still needs
the approved removal of Seat/device/PWA remnants and any broader fleet/admin UI
cleanup. No Phase 7 code is included in this phase.
