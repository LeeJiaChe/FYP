# Final Testing Evidence

## Verification layers

| Layer | What it proves |
|---|---|
| Unit/specification | Pure policies: journeys, timing/progress, lifecycle, credit, analytics formulas, telemetry and realtime contracts |
| Architecture | Prisma/server-only boundaries, thin transport rules, feature import direction and client/server separation |
| PostgreSQL integration | Real constraints, migrations, locks, atomic multi-row transitions, concurrent races and historical snapshots |
| Browser E2E | Complete visible mutations across Student, Driver and Admin portals with deterministic seeded preconditions |
| Production build | Next.js route/type compilation and deployable bundle generation |
| GitHub Actions | Repeats all gates on Node 20, PostgreSQL 16 and Chromium from a clean checkout |

## Invariant-to-evidence map

| Invariant | Primary evidence |
|---|---|
| Adjacent seat reuse and overlapping conflict | Phase 4 PostgreSQL suite |
| One same seat across a multi-segment journey | Booking unit/specification and Phase 4 integration |
| Oldest-compatible-first waitlist fairness | Booking unit and Phase 4 integration |
| WalkInIntent consumes zero capacity | Phase 5 integration |
| Concurrent final standing place cannot over-admit | Phase 5 real PostgreSQL concurrency |
| Boarding/alighting preserve planned claims | Phase 5 integration |
| No-show uses actual progress and is retry-safe | Phase 6 integration |
| Appeal restores recorded credit once | Phase 6 concurrency integration |
| Bus/Driver overlap and cancellation effects | Phase 7 integration |
| GPS is persisted/source-tagged and retention-bounded | Phase 8 integration |
| Realtime Trip scope and event whitelist | Realtime unit/contract tests |
| Real Student/Driver/Admin mutations | Playwright core-flow suite |
| 320 px overflow and keyboard modal close | Playwright mobile suite |

## Interpretation

The suite demonstrates the listed behaviors; it does not mean “100% tested,”
prove absence of every defect, replace actual camera/manual checks, or constitute
large-scale performance/security testing. Final counts and clean-migration
evidence are recorded in `PHASE_10_RELEASE_READINESS.md`. The Phase 10 release
candidate passed 73 unit/specification tests, 10 architecture tests, 61 real
PostgreSQL 16 integration tests, and 8 Chromium browser E2E tests after all six
migrations were applied to clean isolated databases.
