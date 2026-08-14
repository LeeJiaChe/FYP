# Architecture v2 Repository Audit

Audit date: 2026-08-14

Branch: `architecture-v2`

GitHub scope: `jclee-wm25/FYP` issue #2

Target architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## 1. Executive conclusion

The repository is a valuable functional prototype, but its present structure is
not a safe base for incremental feature work. The main problem is not Next.js or
PostgreSQL. It is that HTTP handlers directly own authorization, business rules,
transactions, persistence, notification creation, and realtime publication.
The same rules are consequently duplicated, incompletely enforced, and difficult
to test.

The recommended migration is **strategy 3: build the clean Architecture v2
structure and migrate feature-by-feature**. Preserve PostgreSQL, the approved
product specification, stable URLs, useful visual components, and demonstrated
behavior. Rewrite the application/use-case seams and the high-risk state
transitions as each feature moves. Do not perform a blank-slate product rebuild or
a giant file move.

This recommendation is more substantial than “tidy the folders,” but less risky
than a full rebuild. The existing Prisma model, pages, components, and demo seed
provide useful behavioral evidence. The route-handler business logic and current
test approach should not be preserved merely because they exist.

No implementation phase was started as part of this audit.

## 2. Scope and evidence reviewed

The audit inspected all 128 tracked files, including:

- `AGENTS.md` and all seven documents under `framework/`;
- issue #2 and its empty comment thread;
- `AUDIT_LOG.md`, `README.md`, `NOTES.md`, both proposal documents, and the
  prior UI/UX report;
- all 29 Route Handler files and every App Router page;
- all components, hooks, shared libraries, types, Proxy, CSS, and configuration;
- Prisma schema, the sole SQL migration, and the destructive demo seed;
- the Socket.io/cron process;
- all test scripts and their custom runner;
- root utilities, scratch patch scripts, icon generators, and public assets.

Relevant bundled Next.js 16.2.11 documentation was reviewed before making
framework recommendations: project structure, Server/Client Components, Route
Handlers, Proxy, authentication/authorization, data security/DAL, Backend for
Frontend security and caveats, PWA guidance, production checklist, testing, and
Next.js 16 async request API/proxy changes.

Repository metrics that help size the restructuring:

| Measure | Current value |
|---|---:|
| Tracked files | 128 |
| TypeScript/TSX files | 88 |
| Route Handler files | 29 |
| Files marked as Client Components | 27 |
| Application files importing the Prisma singleton | 29 |
| `fetch()` call sites in app/components/hooks/lib | 37 |
| Explicit `any`/type escape findings in app code scan | 138 |
| Declared custom test cases | 51 |
| Test source-file inspection calls | 35 |

## 3. Source-of-truth assessment

The authority order for migration should be:

1. `framework/APP_SPECIFICATION.md`, except where the owner explicitly amends it.
2. Approved decisions recorded in `NOTES.md` or a new ADR, if they do not conflict
   with the specification.
3. The FYP proposal as scope evidence.
4. Existing behavior and code as characterization evidence only.
5. `README.md` and historical audit claims as non-authoritative descriptions.

Current contradictions and drift:

| Topic | Evidence | Audit conclusion |
|---|---|---|
| Database | Specification, Prisma schema, migration, notes, and proposal say PostgreSQL; README architecture, stack, environment, and setup said SQLite at audit start | PostgreSQL is intentional. README was corrected by this audit. Do not revert the schema. |
| PWA | Specification requires installability; `NOTES.md` said no decision was finalized at audit start; manifest exists but icons are 1×1 and no service worker exists | Manifest/installability is core; offline caching is stretch. NOTES was corrected, but the implementation remains incomplete. |
| GPS tracking | Specification explicitly excludes GPS/live location; UI exposes “Real-Time Bus Tracker” driven only by schedule interpolation | Remove the feature from core scope. A small disclosure does not make an out-of-scope tracker a requirement. |
| Segments | UI/proposal promise Route → Date → Segment → Seat; schema and booking request store no boarding/drop-off stop | Resolve whether segments affect a booking. Current UI selection is discarded. |
| Admin CRUD | Specification/proposal promise CRUD for buses, routes, trips, and drivers | APIs and UI are partial: no route edit/delete UI, no driver-create UI, no trip edit/delete/assignment UI. |
| Dynamic QR | UI calls it encrypted, single-use, and anti-screenshot | JWT is signed, not encrypted. Short expiry reduces replay risk but cannot prevent screenshots. |
| Prior audit | `AUDIT_LOG.md` marks broad areas fixed and says E2E 11/11 passed | Several claimed fixes are incomplete; the current auth test targets removed `middleware.ts`. Treat the log as history, not proof. |
| Timeline | Proposal schedule ends May 2026; issue states January 2027 submission | Planning documents need one maintained timeline. |

## 4. Current-state architecture map

| Area | Current responsibility | Coupling/problem |
|---|---|---|
| `app/` | Routes, all portal pages, auth forms, settings, 29 HTTP endpoints | Portal pages are large Client Components. Route Handlers combine transport, auth, policy, Prisma, transactions, notifications, and realtime. |
| `components/` | Shared UI plus role-specific panels | Useful visual pieces exist, but most props are `any`; modal and theme patterns are inconsistent; feature behavior leaks into presentation. |
| `hooks/` | Fetch current user and trips | Duplicates requests already made by `Navbar`; no typed shared response contracts; driver scoping is delegated to a user-supplied query parameter. |
| `lib/auth.ts` | Passwords, JWTs, cookie read, current user | Server-only boundary is not declared; session payload contains name/email; auth and role checks repeat in every endpoint. |
| `lib/validations.ts` | Some Zod request schemas | Central grab bag; five JSON-mutating endpoints lack Zod body validation and route/query parameters are mostly unvalidated. |
| `lib/prisma.ts` | Prisma singleton | Imported by essentially every endpoint; there is no feature data-access boundary. |
| `lib/realtime-client.ts` | HTTP emit to Socket.io | Untyped `any`, does not check response, secret is sent in JSON body, and several call sites do not await it. |
| `proxy.ts` | Optimistic role redirects | Correct Next.js 16 filename, but contains a second hand-written JWT verifier and does not cover `/settings`; it cannot replace secure authorization. |
| `prisma/` | PostgreSQL model, one initial migration, destructive seed | Useful baseline but insufficient constraints and indexes; mutable bus capacity is incorrectly reused as historical trip capacity. |
| `realtime/server.js` | Socket rooms, emit endpoint, one-minute cron | Client room joins are unauthenticated; no payload bounds/schema; scheduler and broadcasting are coupled in one JS file. |
| `tests/` | Custom assertions, source scans, live HTTP scripts | No package test script, no browser E2E framework, heavy source-string assertions, shared mutable DB, obsolete file references, and direct-DB bypasses. |
| `types/index.ts` | Handwritten frontend interfaces | Already disagrees with Prisma (`SCHEDULED`, booking `CHECKED_IN`, penalty `RESOLVED`); not a valid contract source. |
| `app/globals.css` | Theme tokens, utilities, animations, component styles | 724-line global stylesheet; accessibility lacks reduced-motion support and root viewport disables user zoom. |
| `scratch/`, root Python scripts | One-off regex rewrites | Committed mutation scripts are dead and can accidentally damage current files if rerun. |
| `public/`, icon scripts | PWA and template assets | Declared 192/512 icons are actually 1×1 fallback pixels; default Next/Vercel SVGs are unused. |

### Oversized and mixed-responsibility files

| File | Lines | Main problem |
|---|---:|---|
| `components/student/TripsTab.tsx` | 760 | Six filters, a route grid, segment wizard, modal state, simulated tracking, and display logic in one component |
| `app/admin/page.tsx` | 677 | Fetching for six areas, Socket.io, every CRUD form, modal state, and portal composition |
| `app/student/page.tsx` | 437 | Five resource fetches, booking/cancel/appeal/QR/tracking orchestration, and all modal state |
| `prisma/seed.ts` | 401 | Destructive reset, fixtures, schedule generation, booking setup, penalties, and notifications |
| `components/Navbar.tsx` | 397 | Session fetch, 15-second notification polling, theme picker, notification panel, and user menu |
| `app/driver/page.tsx` | 369 | Trip query/polling, lifecycle changes, check-in, delay form, and full UI |
| `app/api/trips/[id]/route.ts` | 219 | Three role-specific DTO policies plus mutation state/cascade logic |

### Duplicated business logic

- Waitlist promotion exists separately in booking cancellation and account
  deletion. The variants do not reorder or publish events consistently.
- Trip cancellation and booking/seat release exist in both trip status updates
  and bus status updates.
- Authentication/role checks, Zod error detection, generic 500 responses, and
  Prisma exception handling repeat across handlers.
- Credit restriction thresholds, cancellation cutoff, boarding buffer, and
  penalty points are magic numbers in multiple layers.
- Current-user fetching is duplicated by portal hooks, settings context, and the
  navbar.
- UI types are independently reconstructed in API mapping, `types/index.ts`,
  component prop declarations, and `any` state.
- Fetch/error/loading patterns repeat in each portal page.

### Dead, misleading, or accidental code

- `scratch/fix_admin.py`, `scratch/fix_student.py`, `scratch/fix_tier2.py`, and
  `split_trips.py` are already-applied regex mutation scripts.
- `check_db.ts` is an unregistered diagnostic and belongs in documented tooling
  only if still needed.
- `scripts/generate-icons.js` intentionally generates 1×1 pixels while the
  manifest claims larger icons. `generate-pwa-icons.js` requires undeclared
  `canvas` and silently does nothing when unavailable.
- `BusLocationTracker`, `TrackBusTab`, and the trip “live map” are schedule
  interpolation for an explicitly out-of-scope GPS feature.
- Many settings controls have no persistence or effect: compact/reduced motion,
  high contrast, language selection, notification preferences, privacy toggles,
  2FA, export, reset, support, and account deletion button.
- Unused template SVGs and multiple unused imports/variables remain.

## 5. Audit findings by required dimension

Severity reflects risk to the FYP's correctness, security, demo, or defence—not
hypothetical enterprise scale.

| # | Dimension | Severity | Evidence and conclusion |
|---:|---|---|---|
| 1 | Requirements consistency | High | Segment selection is discarded, GPS tracking is out of scope, admin CRUD is incomplete, QR wording overclaims, and documentation disagrees on DB/PWA. |
| 2 | Repository structure | High | Route Handlers are the de facto business layer; 29 app files import Prisma directly; scratch mutation scripts are tracked. |
| 3 | Frontend boundaries | High | All three portals are large Client Components; 27 client boundaries and broad `any` props make server/client and feature ownership unclear. |
| 4 | State/data fetching | Medium | Ad hoc effects and 37 fetch sites cause duplicate user/trip calls, silent non-OK responses, polling, and no consistent invalidation policy. |
| 5 | API architecture | High | Public Route Handlers have no common adapter/error envelope; transport code contains policy and transactions. |
| 6 | Domain logic placement | Critical | Booking, promotion, cancellation, no-show, check-in, appeal, and trip lifecycle rules live in handlers and are duplicated. |
| 7 | Database model | High | Good PostgreSQL/FK baseline, but missing state/check constraints, one-penalty guarantee, active-booking uniqueness, historical capacity strategy, and query-aligned composite indexes. |
| 8 | Authentication/authorization | Critical | Any authenticated driver can request another trip's manifest PII; driver trip-list scoping trusts `driverId`; Proxy is only optimistic and duplicates token verification. |
| 9 | Validation/errors | High | Account, password, profile, scan, and manual-check-in bodies lack Zod; most IDs/query values are unvalidated; business conflicts often become generic 500s. |
| 10 | State transitions | Critical | Trip updates accept arbitrary enum transitions. Manual check-in accepts non-confirmed/wrong-trip bookings. Booking creation does not reject past, cancelled, departed, or non-bookable trips. |
| 11 | Concurrency | Critical | No-show jobs can double-process and double-penalize under concurrent/retried runs. Scan/manual check-in read state before the transaction. Appeal approval uses a stale pre-transaction credit score. |
| 12 | Realtime | Critical | Socket clients join any guessed trip room without authentication/authorization. Several emits are unawaited and failures are swallowed; driver uses polling rather than Socket.io. |
| 13 | Notifications/jobs | High | No departure-reminder job, no distinct penalty-issued notification in no-show flow, device updates do not broadcast, and job work is partially committed per booking/trip. |
| 14 | Security | Critical | Ineffective process-local 100/minute auth limiter, untrusted `x-forwarded-for`, no origin/CSRF validation layer, no CSP/security headers, shared JWT/QR fallback secret, and unbounded realtime body. |
| 15 | Testing | Critical | Tests primarily inspect text, one test targets nonexistent `middleware.ts`, no standard runner/scripts or CI evidence, and “E2E” scripts require shared live state and sometimes bypass APIs. |
| 16 | FYP-scale performance | Medium | Endpoints return all trips/routes/appeals without pagination/time bounds; analytics loads nested routes/trips/seats/bookings in memory; device logs grow unbounded. |
| 17 | Accessibility/mobile/PWA | High | Browser zoom is disabled, dialogs lack focus/keyboard semantics, status relies heavily on color, nested scroll regions exist, real PWA icons/service-worker plan are absent. |
| 18 | Documentation drift | High | At audit start README was SQLite-oriented and notes contradicted the PWA specification; those statements are corrected in this documentation change, while historical audit claims and the proposal schedule remain stale evidence. |
| 19 | Dead/duplicate code | High | Scratch scripts, unused assets/imports, fake settings, duplicate modal styles, and repeated policies create accidental maintenance paths. |
| 20 | AI maintainability | Critical | No import rules, domain APIs, typed contracts, state-transition module, or architecture tests; a future edit can copy a nearby handler and create another source of truth. |

## 6. Highest-risk correctness and security defects

These are audit findings, not fixes performed by this task.

### Critical

1. **Manual check-in crosses trip and state boundaries.** With a valid assigned
   trip URL, a driver can submit a `bookingId` from another trip. The handler does
   not assert `targetBooking.tripId === tripId` or `status === CONFIRMED`; a
   waitlisted, cancelled, no-show, or unrelated booking can become `COMPLETED`.
2. **No-show processing is not retry/concurrency safe.** It selects candidates
   outside transactions, does not lock or conditionally claim them, and has no
   unique `Penalty.bookingId`. Two scheduler calls can deduct twice and create
   duplicate penalties.
3. **Driver PII authorization is too broad.** Trip detail reveals student names
   and IDs to every `DRIVER`, not only the assigned driver. The list endpoint also
   accepts an arbitrary `driverId` and otherwise returns all trips.
4. **Booking accepts invalid trips.** The create path checks only that a trip
   exists. It does not enforce future time, boarding/cancellation cutoffs, trip
   lifecycle, active bus/route, or the approved booking window.
5. **Realtime subscriptions are unauthenticated.** Any permitted web origin can
   connect and join `trip:<uuid>`. Room names are not authorization.
6. **Trip lifecycle is not a state machine.** Admin/driver can set any listed
   status from any current status, including reversing terminal trips or
   cancelling after completion.

### High

1. QR issuance omits the required pre-departure window and trip-state check.
   Check-in state is read before the transaction, so concurrent scans are not
   safely claimed.
2. Bus capacity remains a mutable source for trip totals. Capacity increases do
   not add trip seats; historical trip analytics change when the bus changes.
3. Trip creation does not validate route existence/deletion, bus active status,
   driver role, future departure, arrival ordering, or bus/driver schedule
   conflicts. The bus snapshot is read before the creation transaction.
4. Appeal approval calculates restored credit from a stale record read before the
   transaction, risking lost credit updates.
5. Soft deletion is inconsistent: buses are soft-deleted, routes are hard-deleted
   despite having `deletedAt`, and active queries do not filter deleted buses.
6. Account anonymization duplicates cancellation/promotion rules, does not do all
   work claimed by its comment, does not mark an account inactive, and emits no
   realtime changes. It is outside the core specification and should not compete
   with core stabilization.
7. Analytics does not implement “past N weeks by route/time-slot.” It mixes
   future/current/historical trips, uses present seat state and mutable bus
   capacity, and loads full nested collections into application memory.
8. Registration/login rate limits are set to 100 per minute “for tests,” stored in
   one process, and keyed by an unvalidated forwarding header. This is not the
   fixed critical control claimed by the old audit.
9. `types/index.ts` uses enum values that do not exist in Prisma. This already
   causes the driver start button to test for `SCHEDULED` while the database sends
   `NOT_STARTED`, so normal unstarted trips cannot be started from that UI branch.
10. The seed can create inconsistent data: Route 3 seats are set `RESERVED`
    without bookings, and a no-show booking is attached to a seat without setting
    its seat status to `NO_SHOW`.

## 7. KEEP / REFACTOR / REWRITE / DELETE / MOVE / MERGE / SPLIT decisions

The action column gives the primary decision; combined actions are used only
where separating them would hide the migration intent.

| Major area | Decision | Reason and expected benefit |
|---|---|---|
| Product specification | KEEP + REFACTOR | Keep as authority; clarify only contradictions listed in §10 so implementation has defensible rules. |
| PostgreSQL and initial migration | KEEP | Correct intentional platform and a useful baseline. Add migrations; never revert to SQLite or edit the applied initial migration. |
| Prisma schema | REFACTOR | Preserve core entities/enums while adding constraints, indexes, deletion consistency, and an approved stop/segment model. |
| Demo seed | REWRITE + SPLIT | Keep demo intent but separate reset, factories, scenarios, and relative-time generation; make invalid fixture states impossible. |
| Public/portal App Router URLs | KEEP | Existing user-facing URLs are useful compatibility boundaries for incremental migration. |
| Internal API URLs | KEEP, then MERGE + REFACTOR | Keep each endpoint working while its feature migrates; normalize resource routes and merge duplicate driver endpoints only after typed callers switch. |
| Root `app/` source | MOVE | Move application code under `src/` in a dedicated mechanical phase after tests protect behavior. |
| Portal pages | SPLIT + REFACTOR | Convert pages to server composition/session boundaries and feature client islands; reduce JS and mixed ownership. |
| Student booking wizard visuals | KEEP + REFACTOR | Preserve useful flow and seat UI; remove discarded segment step unless its data model is approved. |
| Simulated bus location tracking | DELETE | GPS/live location is explicitly out of scope and schedule interpolation is misleading demo surface. |
| Device-health simulation | KEEP + REFACTOR | Explicitly required proof-of-concept; make ownership, retention, active-trip targeting, and realtime invalidation clear. |
| Admin portal | SPLIT + REWRITE | Retain visuals/charts but move each feature's fetch/form logic to its module and complete only required CRUD. |
| Driver portal | REFACTOR | Keep manifest/boarding concept; fix status contracts, use authorized data, Socket invalidation, and shared dialogs. |
| Settings page | DELETE + REWRITE | Delete non-functional/out-of-scope controls. Keep only implemented profile, password, theme, and justified account controls. |
| Shared visual primitives | KEEP + REFACTOR | Modal, confirmation, status, seat grid, and theme tokens are useful; add accessibility and typed props. |
| `Navbar` | SPLIT | Separate server-resolved user, navigation, notification menu, theme picker, and user menu; remove duplicate session fetch. |
| Handwritten `types/index.ts` | REWRITE + MOVE | Replace drifted global interfaces with feature request/response DTO contracts. |
| `hooks/useAuth.ts` and settings user fetch | MERGE | One server-resolved current-user flow removes duplicate requests and stale types. |
| `hooks/useTrips.ts` | REWRITE + MOVE | Replace unrestricted generic query with role-specific feature queries/hooks. |
| `lib/auth.ts` | SPLIT + REFACTOR | Separate session crypto/cookie, current actor, password policy, and authorization. Mark server-only. |
| `proxy.ts` | REFACTOR | Keep optimistic redirects, reuse a safe minimal session verifier, cover settings, and document that use-case auth is mandatory. |
| `lib/validations.ts` | SPLIT + MOVE | Co-locate Zod contracts with features so API/UI/test share one schema. |
| `lib/prisma.ts` | MOVE | Keep singleton implementation in `shared/db`; feature persistence becomes the only application consumer. |
| Route Handler logic | REWRITE + SPLIT | Retain endpoint files as thin adapters; move all policy/transactions into feature use cases. |
| Booking/waitlist logic | MERGE + REWRITE | One application service for booking/cancel/promotion/account-related release prevents variant behavior. |
| Trip cancellation cascades | MERGE + REWRITE | One trip cancellation use case serves admin, driver, and bus-retirement paths. |
| QR/manual boarding | MERGE + REWRITE | Share one locked check-in transition after QR-specific verification; fixes IDOR and race issues. |
| No-show/penalty job | REWRITE | Make claim/idempotency/penalty/credit/notification one tested workflow with safe retries. |
| Analytics queries | REWRITE | Use bounded historical queries and correct denominators/snapshots at FYP scale. |
| Notification API | REFACTOR | Keep simple in-app model; add reminder ownership, mark-all operation, pagination, and honest preferences. |
| Realtime service | REWRITE + SPLIT | Keep required separate process; add client auth, typed events, bounded emit adapter, and isolated scheduler. |
| Current tests | REWRITE | Preserve scenarios, not implementation. Replace string checks and direct DB bypass with unit/integration/contract/browser tests. |
| `AUDIT_LOG.md` | KEEP as history | Do not use as a completion gate. Link this dated audit and explicitly mark historical claims as superseded. |
| Proposal and moderation documents | KEEP + MOVE | Preserve them as FYP scope/reference evidence under `docs/reference`; do not treat their schedule or implementation wording as live architecture. |
| Prior UI/UX audit | KEEP + MOVE | Preserve it under `docs/audits`; carry still-valid findings into phase acceptance tests instead of editing history. |
| `CLAUDE.md` | KEEP | Its one-line pointer keeps agent instructions consistent without duplicating policy. |
| `framework/Todo.md` | MERGE + DELETE | Merge its useful uncertainty rule into maintained agent/project guidance; a vaguely named second instruction file should not remain a hidden authority. |
| README/NOTES | REFACTOR | Correct PostgreSQL/PWA/current architecture statements and link normative docs. |
| Scratch Python/rewrite scripts | DELETE | Already-applied, unsafe, and not repeatable build tooling. |
| PWA fallback icon generator and template SVGs | DELETE | Misleading/unused artifacts; replace with real reviewed assets. |
| PWA manifest/icons | KEEP + REFACTOR | Native manifest support is correct; supply genuine sized/maskable icons and verify deployed installability. |
| `check_db.ts` | MOVE or DELETE | If its invariant check remains useful, turn it into a named script/test; otherwise remove it. |

## 8. Proposed Architecture v2 summary

The complete normative design and exact tree are in `ARCHITECTURE.md`. In short:

- `src/app` is a transport and presentation shell.
- `src/features/<feature>` owns contracts, pure domain policies, application use
  cases, minimal Prisma adapters, and feature UI.
- Route Handlers validate and delegate; they do not implement transitions.
- Server Components call feature queries directly, not the application's HTTP
  endpoints.
- Cross-feature calls use explicit server facades; shared code imports no feature.
- PostgreSQL constraints and transactions protect the most important invariants.
- Socket.io broadcasts authenticated, non-PII invalidations only.
- Scheduled entry points invoke retry-safe use cases.
- Unit, PostgreSQL integration, API/realtime contract, browser E2E, and dependency
  tests provide distinct evidence.

## 9. Migration strategy and ordered implementation phases

### Recommended strategy

Choose **strategy 3: build a clean v2 structure and migrate feature-by-feature**.

Use a same-repository strangler approach:

1. Keep current URLs and pages working.
2. Add the smallest target folders needed for the feature being migrated.
3. Characterize the current approved behavior and add invariant/security tests.
4. Implement one new use case and make the existing Route Handler delegate to it.
5. Switch the relevant UI to the typed contract.
6. Delete the superseded handler/page logic in the same reviewable phase.
7. Run all verification before moving to the next feature.

Do not run old and new mutation logic as dual writers. Do not mass-move files
before their dependencies have a target owner.

### Phase 0 — requirement decisions and baseline

- Obtain owner decisions for the blockers in §10.
- Correct source-of-truth links and PostgreSQL/PWA wording.
- Capture an endpoint/role/state inventory and demo acceptance checklist.
- Define a non-production PostgreSQL test database and deterministic time source.

Exit: every state transition being implemented has an approved matrix.

### Phase 1 — verification safety net and architecture guardrails

- Add standard `typecheck`, unit-test, integration-test, and E2E scripts.
- Replace obsolete/source-text checks with behavior tests for the six critical
  defects in §6, initially allowed to fail as explicit regression targets.
- Add deterministic factories and isolated database cleanup.
- Add import-boundary lint rules and CI for lint, typecheck, tests, and build.
- Make the build independent of external font availability by self-hosting or
  bundling the approved font.

Exit: the repository has trustworthy red/green evidence and a reproducible
baseline. **This is the next implementation phase.**

### Phase 2 — shared server foundation

- Add validated server environment, common errors/HTTP adapter, Prisma boundary,
  clock, ID schemas, `server-only`, origin checks, and security headers.
- Centralize session/cookie/password policy and reduce session DTO data.
- Keep Proxy optimistic; add secure actor/role/resource helpers for use cases.

Exit: new feature code can be built without copying handler boilerplate.

### Phase 3 — booking, waitlist, and cancellation vertical slice

- Add booking contracts, state policy, create/cancel/promote use cases, locks, and
  constraints.
- Migrate existing booking endpoints behind the same URLs.
- Migrate booking list/seat-picker UI to typed DTOs.
- Delete duplicated promotion code; defer or remove account deletion per scope.

Exit: concurrent bookings and cancellations are proven against PostgreSQL.

### Phase 4 — boarding and trip lifecycle

- Implement approved trip transition matrix and assigned-driver queries.
- Add locked shared check-in transition for QR and manual paths.
- Enforce QR window, live binding, and clear conflict errors.
- Migrate driver UI and add authenticated realtime invalidation.

Exit: wrong-trip/wrong-state check-in and arbitrary transitions are impossible.

### Phase 5 — no-show, penalties, appeals, and notifications

- Make no-show processing idempotent and atomic per claimed unit.
- Add one-penalty constraint, live credit calculation, reminders, and notification
  event ownership.
- Migrate appeal submission/review with locked current state.
- Add retry and concurrent-job integration tests.

Exit: repeated scheduler calls produce the same durable result.

### Phase 6 — fleet, scheduling, and admin operations

- Normalize soft-delete behavior and active fleet filters.
- Validate times, roles, active assets, and bus/driver conflicts.
- Implement the required CRUD/assignment UI, not unrelated settings features.
- Make capacity and seat inventory/historical metrics consistent.

Exit: admin workflows required by the specification are complete and safe.

### Phase 7 — monitoring, realtime service, and analytics

- Split/authenticate the realtime service and type its event contracts.
- Target device simulation at relevant active trips with a retention rule.
- Rewrite analytics as bounded historical queries by route/time-slot.
- Keep reconnect/refetch behavior so the dashboard recovers from event loss.

Exit: monitoring is secure and analytics numbers are explainable in the viva.

### Phase 8 — frontend composition, accessibility, and PWA completion

- Move migrated code to `src/`, add route groups/layouts/loading/errors, and split
  portal pages into server shells plus small client islands.
- Remove fake settings and simulated GPS tracking.
- Fix keyboard/focus/zoom/reduced-motion/color-only issues.
- Replace 1×1 icons and verify manifest/installability over deployed HTTPS.
- Implement offline caching only if it remains approved stretch scope.

Exit: mobile and desktop core flows pass browser E2E and accessibility checks.

### Phase 9 — documentation, demo rehearsal, and defence evidence

- Update README/setup/deployment, ERD, runtime diagram, API contracts, and
  architecture decisions to match the final code.
- Seed deterministic near-future demo scenarios without invalid states.
- Record test, concurrency, security, Lighthouse, and failure-recovery evidence.

Exit: a fresh clone can be set up and the scripted multi-role demo can be
repeated without manual database repair.

## 10. Unresolved risks and decisions required

These are not reasons to stop the audit. They are explicit inputs needed before
the affected implementation phase.

| ID | Decision/uncertainty | Why it matters | Required by phase |
|---|---|---|---:|
| Q1 | Are boarding/drop-off segments persistent booking data, and do they affect seat reuse by segment? | Current UI discards them. Segment-aware occupancy materially changes the model and concurrency rules. | 0/3 |
| Q2 | What is the exact `TripStatus` transition matrix, especially entering/leaving `DELAYED`? | The enum mixes lifecycle and disruption; no-show currently forces delayed trips to departed. | 0/4 |
| Q3 | Exact configurable values: booking open window, cancellation cutoff, QR window, boarding buffer, penalty points, restriction threshold | “e.g.” values in the spec should become approved constants/config, not guesses. | 0/3–5 |
| Q4 | Can admins cancel after departure or override terminal states? Must an override be audited? | Defines authorization and state-machine exceptions. | 0/4 |
| Q5 | Should a no-show ever promote a waitlist? The specification says promotion for a no-show before the deadline, while detection runs after the deadline. | The stated trigger is temporally unreachable without another early-release concept. | 0/5 |
| Q6 | Is the paste-token driver demo accepted, or is camera scanning required for assessment? | The current UI is not a scanner despite its label; camera support affects browser permissions/testing. | 0/4 |
| Q7 | Is self-service account deletion/data export in approved FYP scope? | Current partial implementation adds risky duplicate business logic and fake controls. | 0/3/8 |
| Q8 | Deployment topology for Next.js, PostgreSQL, and the long-running realtime/cron process | Determines shared rate limiting, environment URLs, HTTPS, process supervision, and cron guarantees. | 0/2/7 |
| Q9 | Required retention for notifications and `DeviceStatusLog` | Current tables grow without bounds; a simple FYP policy is sufficient. | 7 |
| Q10 | Is offline trip-list caching still desired as stretch scope, and what private data may be cached? | Service-worker caching can leak stale/private data if added casually. | 8 |
| Q11 | May email/student IDs be normalized case-insensitively, and what TAR UMT formats are valid? | PostgreSQL uniqueness is case-sensitive by default; auth identity correctness depends on policy. | 2 |
| Q12 | Is `RouteStop` normalization approved, or should routes remain whole-trip-only? | Determines whether JSON text is acceptable and whether segment selection remains. | 3/6 |
| Q13 | Are the proposal's academic citations verified and accepted by the supervisor? | Some claims are precise and should be defensible independently of software quality. | 9 |

## 11. Verification performed

| Check | Result | Interpretation |
|---|---|---|
| `npm ls --depth=0` | Completed; declared dependencies resolve, with several extraneous transitive packages reported | Install is usable but lock/install hygiene should be checked in Phase 1. |
| `npm run lint` | Failed: 227 findings (167 errors, 60 warnings) | Current branch does not meet its lint gate. Dominant issues are explicit `any`, React effect/purity rules, unused code, and JS CommonJS linting. |
| `npx tsc --noEmit --pretty false` | Failed: two `TS1501` errors in `tests/auth-security.test.ts` because regex dotAll requires ES2018 while target is ES2017 | Application type safety is not proven by the current command. Add a real script and align test/runtime config. |
| `npm run build` | Inconclusive in this restricted environment: Turbopack could not fetch Google Inter CSS | The external font dependency blocks offline/restricted builds. No claim is made about later build stages. |
| `npx prisma validate` | Passed; deprecation warning for `package.json#prisma` seed config | Schema syntax is valid. Move to `prisma.config.ts` before Prisma 7. |
| `npx prisma migrate status` | Could not connect to configured PostgreSQL at `localhost:5432` (`P1001`) | Migration application and database state were not verified. PostgreSQL itself remains intentional. |
| `npx tsx tests/auth-security.test.ts` | Could not run because `tsx` IPC pipe creation was denied by the environment | Retried with Node's loader below. |
| `node --import tsx tests/auth-security.test.ts` | 28 passed, 1 failed; failure is obsolete `middleware.ts` path | Passing string assertions do not validate runtime behavior. |
| `node --import tsx tests/phase1-2-3-fixes.test.ts` | 7 passed | These are source-presence assertions, not integration evidence. |
| Phase 4/5 live integration scripts | Not run | They require a running app and PostgreSQL; the database was unavailable. The Phase 5 driver test also bypasses the API with direct Prisma writes. |

Verification did not mutate application data. No production-grade, race-free, or
complete-coverage guarantee is made from the current evidence.

## 12. Recommended next action

Start **Phase 1 — verification safety net and architecture guardrails** after the
Phase 0 owner decisions are recorded. The first implementation review should add
trustworthy behavior tests and CI/scripts around the current URLs and critical
invariants. It should not move all source files or begin the broad feature rewrite.

Once the safety net is credible, migrate the booking/waitlist/cancellation slice
first because it supplies the transaction and module patterns needed by boarding,
no-show, penalties, notifications, and monitoring.
