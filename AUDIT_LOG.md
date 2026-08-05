# Code Review Audit Log & Checklist

## Checklist

- [ ] **Setup**
  - [x] Read spec (Note: `APP_SPECIFICATION.md` is missing, asked user)
  - [x] Create `AUDIT_LOG.md`
  - [x] Clarify App Store vs PWA deployment
- [ ] **Phase 1: Auth & Role Logic Correctness**
  - [ ] Trace signup → login → session/token issuance → every protected route
  - [ ] Confirm role checks are correctly enforced on the server for API endpoints
  - [ ] Password handling correctness
  - [ ] Session handling correctness
  - [ ] Server-side checks for user-supplied IDs
- [ ] **Phase 2: Cross-Role Data Integrity**
  - [ ] Trace Admin changes (buses, trips, routes, drivers) cascading to Students/Drivers
  - [ ] Confirm multi-step state changes use database transactions
  - [ ] Concurrent booking/editing correctness
  - [ ] Real-time/refresh behavior on the Student dashboard
- [ ] **Phase 3: Correctness Categories**
  - [ ] Input validation on every form/API
  - [ ] State-changing requests legitimate user enforcement (CSRF, etc.)
  - [ ] Secrets/environment variables hardcoded check
  - [ ] Error handling safety
  - [ ] Public endpoints rate limiting
  - [ ] File upload handling (if any)
  - [ ] Account deletion / data export flow
  - [ ] Dependency audit tooling
  - [ ] Performance correctness (N+1 queries, missing indexes, etc.)
  - [ ] Network failure / offline gracefulness
  - [ ] Sensitive data in logs check
- [ ] **Phase 4: Tests**
  - [ ] Write tests for every fixed bug, prioritizing auth/role logic and admin cascade logic

## Findings

| ID | Severity | Area | Description | Status |
|---|---|---|---|---|
| 001 | Critical | Auth | Missing rate limiting on `/api/auth/login` and `/api/auth/register` endpoints, leaving them vulnerable to brute-force credential stuffing. | Fixed |
| 002 | High | Auth | Logout only clears the client-side cookie. Because JWTs are stateless and there is no token blacklist or `tokenVersion` check, stolen tokens remain valid until they expire (7 days) even after logout. | Fixed |
| 003 | Critical | Data Integrity | `GET /api/trips/[id]` leaks full PII (student names and IDs) for all passengers to any logged-in user, including other students. It should redact other students' data for non-admin/non-driver roles. | Fixed |
| 004 | High | Cross-Role Data Integrity | If an Admin lowers a Bus's capacity, existing unstarted trips still retain the old number of `Seat` records. `GET /api/trips` calculates `totalSeats` from the current bus capacity, causing bugs where `availableSeats` > `totalSeats`. | Fixed |
| 005 | Medium | Validation | The `PATCH` endpoints for `/api/admin/buses` and `/api/admin/routes` do not use Zod validation on the incoming body, allowing malformed data to be saved directly to the database. | Fixed |
| 006 | Medium | Error Handling | Almost all API endpoints return `err.message` in 500 errors directly to the client, which can leak database schema details, stack traces, or internal implementation details. | Fixed |
| 007 | High | Race Condition | Waitlist promotion uses `aggregate _max` and sets `nextPosition`. Two students joining the waitlist concurrently will receive the exact same waitlist position. | Fixed |
| 008 | High | Dependencies | 4 high severity vulnerabilities found in dependencies via `npm audit` (PostCSS, sharp, brace-expansion). | Fixed |

## Phase 4: End-to-End Logic & State Machine Validation

- **Action:** Wrote comprehensive E2E Integration API Script (`tests/phase4-e2e.test.ts`).
- **Description:** The script uses Node's native `fetch` with automatic cookie parsing to orchestrate a live interaction sequence simulating all three roles:
  1. **Admin** logs in, creates a bus (with artificially low capacity) and a route, then schedules a trip.
  2. **Students A & B** log in and book the available seats simultaneously.
  3. **Student C** attempts a booking and is correctly placed on the Waitlist.
  4. **Admin** attempts an invalid capacity reduction on the bus (testing the Phase 3 block mechanism).
  5. **Student A** cancels their confirmed booking.
  6. **Student C** is verified to be instantly auto-promoted to `CONFIRMED`.
  7. **Driver** checks in Student B via the manual check-in API route.
  8. **Time Warp & Cron:** The script uses Prisma to simulate time passing (moving the trip boarding deadline into the past) and triggers the No-Show Cron API.
  9. **Penalty Execution:** Student C (who didn't check in) is marked `NO_SHOW` and penalized (credit score deducted by 15).
  10. **Student Appeal:** Student C fetches their penalty ID and submits an appeal via the API.
  11. **Admin Resolution:** Admin approves the appeal and the script verifies Student C's credit score is correctly restored to 100.
- **Status:** **Executed Successfully (11/11 Passed)**. All race conditions and constraints behaved as expected under true concurrency.

## Phase 5: UI/UX Audit

- **Action:** Conducted an independent UI/UX audit across Student, Driver, and Admin dashboards based on 7 specific dimensions (Visual Hierarchy, State Clarity, Spacing & Alignment, Feedback & Loading States, Mobile Behavior, UI-Logic Mismatch, Consistency).
- **Findings:** A detailed report was generated and moved to `/ui_ux_audit_findings.md`. It outlines 11 specific issues across 3 priority tiers.
- **Scope Decision Note (Track Bus):** The "Track Bus" real-time bus location tracking is a mock/simulation (it interpolates between departure and estimated arrival times without actual GPS). This is a known, deliberate scope decision as building real GPS tracking is out of scope for the current timeline. The UI has been updated to honestly label this as an estimate ("Simulated tracking — based on schedule, not live GPS") rather than presenting it as true real-time tracking.
- **Status:** **Completed (Tier 1 & 2 fixes applied)** - Implemented Driver trip controls, Admin bus editing, Student cancellation enforcement, global toast notifications, shared Modal component, and resolved all Tier 1/2 UX issues. Additional API tests added in `tests/phase5-ui-logic.test.ts`.
