# Architecture v2 Repository Audit and Phase 0 Alignment

Audit date: 2026-08-14

Branch: `architecture-v2`

GitHub scope: `jclee-wm25/FYP` issue #2

Target architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

Phase 0 amendment status: **Owner decisions incorporated on 2026-08-14; no
implementation or Prisma migration performed.** The current-state evidence below
still describes the prototype, while the decision table, migration phases, and
formerly unresolved questions have been replaced by the approved target rules.

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
| Product form | Owner amendment defines a responsive website, not a PWA; manifest/meta/icon artifacts remain in the prototype | Remove all PWA-specific requirements and later delete the artifacts. Mobile-browser responsiveness remains required. |
| GPS tracking | Owner amendment keeps live location with a GPS simulator and replaceable telemetry pipeline; current UI uses schedule interpolation | Keep the student tracking capability but replace the current fake location calculation with coordinate ingestion and an honestly labelled simulator. |
| Routes and segments | Owner amendment approves directional ordered Stops, From/To search, persisted boarding/drop-off, reserved seat reuse by non-overlapping segments, and journey-aware waitlist | `Stop`, ordered `RouteStop`, per-trip snapshots/segments, and segment allocation records are required. “Segment” is internal, not a required student step. |
| Standing walk-ins | No current model or flow | Add a non-guaranteed WalkInIntent/Pass and create standing claims only during concurrency-safe boarding admission. |
| Seat devices | Prototype schema, cron, seed, API DTO, realtime scheduler, and admin UI implement simulated device health | Remove this feature and its exclusive artifacts in later migration phases. It is no longer approved scope. |
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
| `prisma/` | PostgreSQL model, one initial migration, destructive seed | Useful baseline but incompatible with approved journeys: JSON stops, one bus capacity, whole-trip Seat status, one Booking per Seat, no walk-in/standing/location models, and obsolete device models. |
| `realtime/server.js` | Socket rooms, emit endpoint, one-minute cron | Client room joins are unauthenticated; no payload bounds/schema; scheduler and broadcasting are coupled in one JS file. |
| `tests/` | Custom assertions, source scans, live HTTP scripts | No package test script, no browser E2E framework, heavy source-string assertions, shared mutable DB, obsolete file references, and direct-DB bypasses. |
| `types/index.ts` | Handwritten frontend interfaces | Already disagrees with Prisma (`SCHEDULED`, booking `CHECKED_IN`, penalty `RESOLVED`); not a valid contract source. |
| `app/globals.css` | Theme tokens, utilities, animations, component styles | 724-line global stylesheet; accessibility lacks reduced-motion support and root viewport disables user zoom. |
| `scratch/`, root Python scripts | One-off regex rewrites | Committed mutation scripts are dead and can accidentally damage current files if rerun. |
| `public/`, icon scripts | PWA and template assets | PWA-specific icons/generators now have no approved product consumer and are scheduled for deletion; ordinary favicon/website assets may remain. |

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
- `scripts/generate-icons.js` intentionally generates 1×1 pixels and
  `generate-pwa-icons.js` requires undeclared `canvas`; both are obsolete now that
  PWA scope is removed.
- `BusLocationTracker` calculates location from schedule time. Its implementation
  must be replaced by a telemetry-backed map; `TrackBusTab` remains useful UI
  surface after migration to the source-neutral location contract.
- Many settings controls have no persistence or effect: compact/reduced motion,
  high contrast, language selection, notification preferences, privacy toggles,
  2FA, export, reset, support, and account deletion button.
- Unused template SVGs and multiple unused imports/variables remain.

## 5. Audit findings by required dimension

Severity reflects risk to the FYP's correctness, security, demo, or defence—not
hypothetical enterprise scale.

| # | Dimension | Severity | Evidence and conclusion |
|---:|---|---|---|
| 1 | Requirements consistency | Critical | Approved From/To journeys, segment seat reuse, walk-in standing admission, GPS telemetry, PWA removal, and sensor removal are not represented by the current schema/contracts. This Phase 0 documentation now defines the target. |
| 2 | Repository structure | High | Route Handlers are the de facto business layer; 29 app files import Prisma directly; scratch mutation scripts are tracked. |
| 3 | Frontend boundaries | High | All three portals are large Client Components; 27 client boundaries and broad `any` props make server/client and feature ownership unclear. |
| 4 | State/data fetching | Medium | Ad hoc effects and 37 fetch sites cause duplicate user/trip calls, silent non-OK responses, polling, and no consistent invalidation policy. |
| 5 | API architecture | High | Public Route Handlers have no common adapter/error envelope; transport code contains policy and transactions. |
| 6 | Domain logic placement | Critical | Booking, promotion, cancellation, no-show, check-in, appeal, and trip lifecycle rules live in handlers and are duplicated. |
| 7 | Database model | Critical | Good PostgreSQL/FK baseline, but JSON stops, scalar whole-trip seat status, unique Booking.seatId, and one Bus capacity cannot represent approved segment-aware seated/standing journeys. New trip topology/allocation models are required. |
| 8 | Authentication/authorization | Critical | Any authenticated driver can request another trip's manifest PII; driver trip-list scoping trusts `driverId`; Proxy is only optimistic and duplicates token verification. |
| 9 | Validation/errors | High | Account, password, profile, scan, and manual-check-in bodies lack Zod; most IDs/query values are unvalidated; business conflicts often become generic 500s. |
| 10 | State transitions | Critical | Trip updates accept arbitrary enum transitions. Manual check-in accepts non-confirmed/wrong-trip bookings. Booking creation does not reject past, cancelled, departed, or non-bookable trips. |
| 11 | Concurrency | Critical | No-show jobs can double-process and double-penalize under concurrent/retried runs. Scan/manual check-in read state before the transaction. Appeal approval uses a stale pre-transaction credit score. |
| 12 | Realtime | Critical | Socket clients join any guessed trip room without authentication/authorization. Several emits are unawaited and failures are swallowed; driver uses polling rather than Socket.io. |
| 13 | Notifications/jobs | High | No departure-reminder or auto-alighting job, no distinct penalty-issued notification in no-show flow, and work is partially committed per booking/trip. The device-health job is obsolete and scheduled for deletion. |
| 14 | Security | Critical | Ineffective process-local 100/minute auth limiter, untrusted `x-forwarded-for`, no origin/CSRF validation layer, no CSP/security headers, shared JWT/QR fallback secret, and unbounded realtime body. |
| 15 | Testing | Critical | Tests primarily inspect text, one test targets nonexistent `middleware.ts`, no standard runner/scripts or CI evidence, and “E2E” scripts require shared live state and sometimes bypass APIs. |
| 16 | FYP-scale performance | Medium | Endpoints return all trips/routes/appeals without bounds and analytics loads nested data in memory. Target segment/location tables require query-aligned indexes and a bounded telemetry retention policy. |
| 17 | Accessibility/mobile website | High | Browser zoom is disabled, dialogs lack focus/keyboard semantics, status relies heavily on color, and nested scroll regions exist. PWA installability is no longer a quality criterion. |
| 18 | Documentation drift | High | Phase 0 aligns the normative specification/architecture/notes/README, while proposals, historical audits, and current implementation still contain superseded PWA, sensor, whole-trip, and fake-location statements. |
| 19 | Dead/duplicate code | High | Scratch scripts, PWA artifacts, sensor-only code, schedule-interpolation tracking, unused assets/imports, fake settings, duplicate modal styles, and repeated policies create accidental maintenance paths. |
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
| Prisma schema | REWRITE in forward migrations | Preserve compatible identity/fleet/trip/penalty data, but replace whole-trip seat/waitlist/device assumptions with the approved topology, reserved allocations, walk-in claims, and location telemetry. Do not edit the initial migration. |
| Demo seed | REWRITE + SPLIT | Keep demo intent but separate reset, factories, scenarios, and relative-time generation; make invalid fixture states impossible. |
| Public/portal App Router URLs | KEEP | Existing user-facing URLs are useful compatibility boundaries for incremental migration. |
| Internal API URLs | KEEP, then MERGE + REFACTOR | Keep each endpoint working while its feature migrates; normalize resource routes and merge duplicate driver endpoints only after typed callers switch. |
| Root `app/` source | MOVE | Move application code under `src/` in a dedicated mechanical phase after tests protect behavior. |
| Portal pages | SPLIT + REFACTOR | Convert pages to server composition/session boundaries and feature client islands; reduce JS and mixed ownership. |
| Student booking wizard visuals | KEEP + REWRITE flow | Preserve useful From/To and seat UI, reorder to `From -> To -> Date -> Departure -> Seat`, hide internal segment language, and use journey-scoped availability. |
| Schedule-interpolated location implementation | REPLACE | Keep live-map product surface, but replace time interpolation with simulator coordinate ingestion through a source-neutral location contract. |
| GPS simulator and telemetry pipeline | NEW | Add the smallest replaceable source adapter, ingestion use case, PostgreSQL samples, realtime invalidation, and authorized map query. No general IoT platform. |
| Device-health simulation | DELETE | Owner removed seat sensors, DeviceStatusLog/DeviceSignal, device-health cron, DTO fields, warnings, seed fixtures, and sensor tests from scope. |
| PWA product/artifacts | DELETE | Website remains responsive; later remove manifest behavior, install metadata, PWA icons/generators, service-worker/install claims, and related tests. |
| Directional Stops/Routes | KEEP + REWRITE persistence | Preserve directional UI intent; replace JSON stops with Stop + ordered RouteStop and immutable TripStop/TripSegment snapshots. |
| Whole-trip `Seat.status` availability | REPLACE | Use TripSeat inventory plus ReservedSeatSegment uniqueness so a seat can be reused on non-overlapping journey segments. |
| Booking waitlist fields | SPLIT + REWRITE | Booking represents a guaranteed reserved journey; WaitlistEntry separately stores a non-guaranteed From/To request and promotes only when one seat spans it. |
| Walk-in standing flow | NEW | Separate non-guaranteed WalkInIntent/Pass from admitted WalkInJourney and concurrency-safe StandingSegmentClaims. |
| Alighting | NEW | Store planned drop-off and optional QR/manual/automatic actual alighting without making exit scans a capacity dependency. |
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
| QR/manual boarding | SPLIT shared adapter + REWRITE | Share authentication/transport helpers while keeping reserved allocation, walk-in admission, and alighting transitions explicit and separately tested. |
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
| README/NOTES | REFACTOR | Align responsive-web, directional journey, walk-in, GPS simulator, sensor removal, PostgreSQL, and current/target architecture statements. |
| Scratch Python/rewrite scripts | DELETE | Already-applied, unsafe, and not repeatable build tooling. |
| PWA icon generators and PWA-specific icons | DELETE | No approved installability requirement remains. Keep only ordinary website/favicon assets with a real consumer. |
| `app/manifest.ts` and install metadata | DELETE | PWA behavior is explicitly out of scope; removal is deferred to its implementation phase. |
| `check_db.ts` | MOVE or DELETE | If its invariant check remains useful, turn it into a named script/test; otherwise remove it. |

## 8. Proposed Architecture v2 summary

The complete normative design and exact tree are in `ARCHITECTURE.md`. In short:

- `src/app` is a transport and presentation shell.
- `src/features/<feature>` owns contracts, pure domain policies, application use
  cases, minimal Prisma adapters, and feature UI.
- Ordered RouteStops are snapshotted as TripStops/TripSegments so scheduled and
  historical passenger journeys survive route edits.
- Reserved bookings claim one TripSeat on every traversed segment; walk-in passes
  claim nothing until a locked boarding transaction admits a standing journey.
- Reserved Pass, Walk-in Pass, and alighting are explicit contracts and states.
- A source-neutral location feature accepts simulator coordinates now and a real
  GPS adapter later without changing the student map contract.
- Route Handlers validate and delegate; they do not implement transitions.
- Server Components call feature queries directly, not the application's HTTP
  endpoints.
- Cross-feature calls use explicit server facades; shared code imports no feature.
- PostgreSQL constraints and transactions protect the most important invariants.
- Socket.io broadcasts authenticated, non-PII invalidations only.
- Scheduled entry points invoke retry-safe no-show/reminder/waitlist/auto-alight
  use cases; no seat-device job remains.
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

- Record the approved responsive-web, route/journey, reserved segment, walk-in,
  standing capacity, pass, alighting, GPS simulator, sensor-removal, and no-payment
  decisions in the product source of truth.
- Align Architecture v2, the decision table, model proposal, notes, README, and
  ordered migration plan without changing implementation or Prisma.
- Inventory all obsolete PWA, device-health, schedule-interpolation, discarded-
  segment, and whole-trip availability code for later removal/migration.
- Record the approved operating defaults and migration assumptions in §11.

Exit: normative documents agree, migration impact is classified, and no Phase 1
work has begun. **This documentation task completes that exit condition.**

### Phase 1 — verification safety net and architecture guardrails

- Add standard lint, typecheck, unit-test, PostgreSQL integration-test,
  architecture-test, and build scripts. Defer a browser runner until migrated
  browser workflows exist; do not add a framework merely for script symmetry.
- Retire obsolete/source-text checks as verification gates. Preserve their
  findings in this audit and replace them with executable behavior specifications.
- Establish approved behavioral examples for adjacent/non-overlapping/overlapping
  reserved journeys, journey-aware availability, full standing segments,
  concurrent Walk-in scans, distinct pass types, and simulated location input.
- Add deterministic pure fixtures plus a fail-closed dedicated PostgreSQL test-
  database boundary. Do not pretend the legacy schema can integration-test target
  models that do not exist yet.
- Add import-boundary checks and PostgreSQL-backed CI for lint, typecheck, unit,
  integration, architecture tests, and build.
- Make the build independent of external font availability by self-hosting or
  bundling the approved font.

Exit: the repository has trustworthy red/green evidence and a reproducible
baseline. **Phase 1 completed this exit condition.**

### Phase 2 — shared server foundation

- Add validated server environment, common errors/HTTP adapter, Prisma boundary,
  clock, ID schemas, `server-only`, origin checks, and security headers.
- Add the one validated operating-policy configuration defined in Architecture
  §14; domain code receives resolved policy values and contains no magic numbers.
- Mark existing secret-bearing auth, QR, Prisma, and realtime internals as
  server-only, while leaving the user-visible auth/session migration to its
  ordered feature phase.
- Add same-origin mutation protection and a thin transport adapter without
  turning Proxy or Route Handlers into a second application framework.

Exit: new feature code can be built without copying handler boilerplate.
**Phase 2 completed this exit condition; see
`framework/PHASE_2_SHARED_FOUNDATION.md`.**

### Phase 3 — directional topology and per-trip inventory

- Add Stop/RouteStop travel durations and immutable TripStop/TripSegment models
  through forward migrations. Derive TripStop planned times from the origin
  departure and snapshotted travel offsets.
- Add `seatedCapacity`/`standingCapacity` to Bus and capacity snapshots to Trip.
- Introduce TripSeat inventory and deprecate whole-trip status. A temporary
  compatibility column/relation may remain until Phase 8 removes every device
  code/test consumer and drops the obsolete schema in one controlled slice.
- Implement route compatibility and per-stop schedule/deadline query contracts.

Exit: every scheduled Trip has valid ordered topology, capacity snapshots,
TripSeats, and queryable journey segments.

**Phase 3 implements this exit condition; see
`framework/PHASE_3_TOPOLOGY_AND_INVENTORY.md`. Real PostgreSQL verification is
recorded there rather than inferred from Prisma validation.**

### Phase 4 — reserved journeys and journey-aware waitlist

- Add reserved Booking endpoints, ReservedSeatSegment uniqueness, availability,
  cancellation, and journey-aware WaitlistEntry/promotion use cases.
- Promote oldest-compatible-first in immutable FIFO order. Temporarily
  incompatible earlier entries retain priority for later attempts.
- Current Bookings have no truthful From/To data. The owner confirms that no non-
  demo data must survive, so reset/reseed the development database rather than
  inventing passenger stops.
- Prove simultaneous overlapping claims fail while adjacent journeys can reuse the
  same TripSeat.
- Migrate the student flow to typed `From -> To -> Date -> Departure -> Seat`
  contracts; do not expose a “segment” step.
- Delete old whole-trip booking/promotion logic in the migrated slice.

Exit: reserved journeys and promotions are correct under PostgreSQL concurrency.

**Phase 4 implements this exit condition; see
`framework/PHASE_4_RESERVED_JOURNEYS.md`.**

### Phase 5 — passes, boarding, walk-ins, and alighting

- Implement the approved Trip lifecycle/progress matrix and assigned-driver
  authorization.
- Keep delay as metadata, prohibit terminal reversals, and require a reason plus
  minimal TripStatusHistory for emergency cancellation after departure.
- Add explicit Reserved, Walk-in, and Exit pass contracts.
- Implement real browser-camera scanning; token paste may remain only as a
  labelled development/demo fallback.
- Implement reserved boarding and manual fallback over existing allocations.
- Add WalkInIntent issuance with the non-guarantee disclaimer, plus locked
  first-come admission and StandingSegmentClaims.
- Permit intent issuance regardless of reserved availability, while preventing a
  redundant active intent beside the student's confirmed Booking for the same
  Trip/journey.
- Add QR/manual/automatic alighting without making exit confirmation a capacity
  dependency.
- Prove simultaneous last-place scans cannot exceed standing capacity.

Exit: wrong-trip/stop/journey/pass boarding is impossible and standing admission
is concurrency-safe.

### Phase 6 — no-show, penalties, appeals, and notifications

- Make no-show processing use each passenger's boarding TripStop deadline and be
  idempotent/atomic.
- Add one-penalty constraint, live credit calculation, reminders, and
  notification ownership.
- Migrate appeal submission/review with locked current state.
- Add retry and concurrent-job integration tests.

Exit: repeated scheduler calls produce the same durable penalty and notification
result.

### Phase 7 — fleet, scheduling, and admin operations

- Normalize soft deletion and active fleet filters.
- Complete Stop/Route ordering, Bus seated/standing capacity, per-stop Trip
  timing, active asset, driver-role, and bus/driver conflict validation.
- Implement required CRUD/assignment UI and journey-aware operational manifest.

Exit: approved admin workflows create only valid directional Trip topology and
capacity snapshots.

### Phase 8 — GPS telemetry, realtime, monitoring, and analytics

- Add the GPS simulator adapter, authenticated location ingestion, PostgreSQL
  samples, authorized latest-location query, and `location.changed` invalidation.
- Emit simulator samples every five seconds through the shared ingestion boundary
  and remove samples older than seven days with a retry-safe job.
- Replace schedule interpolation with a map consuming the source-neutral DTO and
  clearly label simulator/prototype telemetry.
- Split/authenticate the realtime service and type occupancy/trip/location events.
- Delete the device-health endpoint, scheduler call, seed fixtures, DTO fields,
  admin warning UI, schema models/enums, and sensor-only tests.
- Rewrite bounded journey-aware seated/standing/location analytics and recovery
  after missed Socket.io events.

Exit: live location and occupancy are secure, recoverable, source-neutral, and
explainable in the viva; no seat-device feature remains.

### Phase 9 — frontend composition, accessibility, and scope cleanup

- Move migrated code to `src/`, add route groups/layouts/loading/errors, and split
  portal pages into server shells plus small client islands.
- Remove fake settings and PWA manifest/install metadata/icons/generators; keep
  only ordinary responsive website assets.
- Remove non-functional account deletion and data-export settings; those
  workflows are outside FYP scope.
- Fix keyboard/focus/zoom/reduced-motion/color-only issues.
- Validate Reserved versus Walk-in wording, standing non-guarantee, From/To flow,
  mobile-browser usability, and location-source disclosure.

Exit: mobile and desktop core flows pass browser E2E/accessibility checks and no
removed-scope UI or metadata remains.

### Phase 10 — documentation, demo rehearsal, and defence evidence

- Update README/setup/deployment, ERD, runtime diagram, API contracts, and
  architecture decisions to match the final code.
- Seed deterministic near-future demo scenarios without invalid states.
- Record test, concurrency, security, Lighthouse, and failure-recovery evidence.
- Verify proposal citations and claims for final documentation/defence; this does
  not block implementation phases.

Exit: a fresh clone can be set up and the scripted multi-role demo can be
repeated without manual database repair.

## 10. Phase 0 migration impact inventory

This inventory records stale implementation and historical references found by
repository-wide search. They deliberately remain in Phase 0; the target action
is documented so later deletion is controlled and reviewable.

### PWA-only scope

| Current location | Later action |
|---|---|
| `app/manifest.ts` | DELETE; manifest behavior is not required. |
| PWA metadata in `app/layout.tsx` | DELETE only the manifest/Apple install metadata; keep responsive viewport and normal website metadata, while restoring browser zoom. |
| `public/icon-192.png`, `public/icon-512.png` | DELETE if they have no ordinary website consumer. Keep `app/favicon.ico`. |
| `scripts/generate-icons.js`, `scripts/generate-pwa-icons.js` | DELETE. |
| PWA claims in `README.md` and `NOTES.md` | Corrected in this Phase 0 documentation change. |
| `AUDIT_LOG.md`, `ui_ux_audit_findings.md`, proposal documents | KEEP as clearly historical evidence; do not rewrite old review/proposal records as if they were current. |

No service-worker implementation or PWA package is currently present.

### Seat sensor/device-health scope

| Current location | Later action |
|---|---|
| `DeviceStatusLog`, `DeviceSignal`, `Seat.deviceLogs` in `prisma/schema.prisma` | DELETE in a forward migration after code consumers are removed. Never edit the applied initial migration that created them. |
| `prisma/migrations/20260802181320_init/migration.sql` | KEEP immutable as migration history even though it contains the original device tables; a later migration drops them. |
| Device reset/fixtures in `prisma/seed.ts` | DELETE when the new deterministic seed is written. |
| `app/api/admin/cron/device-health/route.ts` | DELETE. |
| Device-health scheduler call in `realtime/server.js` | DELETE while splitting the realtime process. |
| `deviceLogs` query and `deviceHealth` DTO in `app/api/trips/[id]/route.ts` | DELETE; replace DTO with journey-aware occupancy only. |
| Sensor title/rendering in `components/SeatGrid.tsx` | DELETE sensor-only fields; retain/refactor the useful seat visual. |
| Sensor warning in `components/admin/LiveMonitoringTab.tsx` | DELETE; retain/refactor trip occupancy monitoring. |
| Device-health security assertion in `tests/auth-security.test.ts` | DELETE/REPLACE with tests for approved internal jobs. |
| Sensor/IoT claims in `app/page.tsx`, README, NOTES, and proposal | Current product docs are corrected; landing-page implementation is scheduled for cleanup, while the proposal remains historical. |

### Schedule-based fake live location

| Current location | Later action |
|---|---|
| `components/BusLocationTracker.tsx` | REPLACE schedule interpolation with a map consuming the authorized latest-location DTO. |
| `components/student/TrackBusTab.tsx` | KEEP + REFACTOR as the tracking surface; remove default fake stops and consume telemetry/recency/source fields. |
| Live-map modal/labels in `components/student/TripsTab.tsx` | REFACTOR to open the telemetry-backed map and label simulated GPS honestly. |
| Tracking orchestration in `app/student/page.tsx` and map CSS in `app/globals.css` | MIGRATE with the location feature; keep only styles/logic used by the real telemetry UI. |

### Discarded segment selections and whole-trip seat locking

| Current location | Later action |
|---|---|
| `Route.stops` JSON and validation/CRUD/seed parsing | REPLACE with Stop + ordered RouteStop and Trip snapshots. |
| From/To state in `components/student/TripsTab.tsx` | KEEP UX intent but REWRITE flow/order and pass TripStop IDs through availability/booking contracts; current selection is discarded when only `tripId` is forwarded. |
| `Booking.seatId @unique`, one-to-one `Seat.booking`, `Seat.status`, `SeatStatus` | REPLACE with TripSeat + ReservedSeatSegment and separate lifecycle states. |
| `app/api/bookings/route.ts`, cancellation/account promotion code, trip cancellation, no-show, scan/manual check-in | REWRITE through the owning use cases; all assume whole-trip seats or combined Booking/waitlist state. |
| `app/api/trips/route.ts`, `app/api/trips/[id]/route.ts`, `app/api/bookings/mine/route.ts` | REWRITE availability/stat DTOs to require a journey or report segment-aware operational occupancy. |
| `components/SeatGrid.tsx`, student/driver/admin pages and trip/booking components | KEEP useful visuals but REFACTOR status language and data contracts around the selected journey. |
| Existing source-inspection/E2E scripts | REWRITE scenarios around adjacent reuse, overlap rejection, waitlist journey, standing admission, and explicit passes. |

No fare, price, refund, or payment-gateway implementation was found. Walk-in
intent/admission, standing-capacity, per-trip location telemetry, and actual
alighting models do not yet exist and are additions, not removals.

## 11. Resolved product/operational decisions

The owner resolved every Phase 0 question before Phase 1. These decisions are
normative and supersede the former uncertainty table:

| ID | Approved decision | Implementation phase |
|---|---|---:|
| Q1 | Waitlist promotion is oldest-compatible-first FIFO; a skipped incompatible entry retains original priority. | 4 |
| Q2 | Trip lifecycle is `NOT_STARTED -> BOARDING -> DEPARTED -> ARRIVED`, with terminal `CANCELLED`; delay is metadata. | 5 |
| Q3 | Central defaults: booking 7 days, cancellation 30 minutes before stop, boarding opens 15 minutes before/closes 5 minutes after unless delayed, QR 60 seconds, credit 100, penalty 15, restrict below 40. | 2/4–6 |
| Q4 | Terminal states do not reverse; emergency cancellation after departure requires a reason and minimal TripStatusHistory. | 5/7 |
| Q5 | Real camera scanning is required; paste-token is dev/demo fallback only. | 5 |
| Q6 | GPS simulator targets 5 seconds, samples are retained 7 days, and every source uses the same ingestion boundary. | 8 |
| Q7 | Student email is trim/lowercase and `@student.tarc.edu.my`; no unverified local-part regex. Student ID is trim/uppercase. | 2 |
| Q8 | Account deletion/export are out of scope; remove their non-functional settings. | 9 |
| Q9 | Route topology stores travel durations; TripStop times derive from origin plus offsets. | 3/7 |
| Q10 | Citation verification is final documentation/defence work and does not block implementation. | 10 |
| Q11 | Walk-in intent is allowed regardless of reserved availability, but not redundantly beside the same student's confirmed same-Trip/journey Booking. | 5 |
| Q12 | No non-demo data must survive; reset and reseed development data during Architecture v2 migration. | 3/4 |

The long-running-process deployment target may be selected during deployment
design, provided it preserves the runtime boundaries already specified. It does
not change product behavior and does not block Phase 1.

## 12. Verification performed

The first four checks below were performed for this Phase 0 alignment. Remaining
rows preserve the original architecture-audit baseline and were not re-run for a
documentation-only change.

| Check | Result | Interpretation |
|---|---|---|
| Phase 0 changed-file check | Only `APP_SPECIFICATION.md`, `ARCHITECTURE.md`, this audit, `NOTES.md`, and `README.md` changed | No application, test, package, migration, seed, or Prisma schema file was modified. |
| Phase 0 stale-reference searches | Completed for PWA/install metadata, device models/cron/UI/tests, schedule interpolation, discarded From/To state, and whole-trip Seat/waitlist assumptions | Remaining references are classified in §10 as historical, DELETE, REPLACE, or MIGRATE. |
| Phase 0 normative contradiction search | No target statement still requires PWA/device monitoring, excludes GPS, or treats segment persistence as optional | Specification, architecture, notes, and current-scope README agree; legacy implementation is labelled as such. |
| `git diff --check` and documentation trailing-whitespace scan | Passed | Documentation patch has no whitespace errors. |
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

### Phase 1 verification addendum

Phase 1 replaced the obsolete test scripts with executable target-policy
specifications, a fail-closed PostgreSQL boundary, and dependency-rule tests. The
current command results and exact isolation contract are maintained in
`framework/PHASE_1_VERIFICATION.md`. The fast `npm run verify` gate passes. The
full legacy lint diagnostic still fails with 155 errors and 54 warnings. Real
PostgreSQL execution is locally blocked because no server is listening; CI now
provisions PostgreSQL 16. The default Turbopack build is blocked by the sandbox's
port restriction after removing the external font fetch, while the webpack
production build completes. No schema or product migration occurred.

### Phase 2 verification addendum

Phase 2 added the shared server/configuration, policy, time, validation, Prisma,
typed-error, HTTP-adapter, origin-protection, and dependency boundaries described
in `framework/PHASE_2_SHARED_FOUNDATION.md`. Existing handlers remain legacy
adapters except for narrow consumption of centralized values; no schema or
product feature migration occurred.

### Phase 3 verification addendum

Phase 3 adds the first forward Architecture v2 schema migration: normalized
Stops/RouteStops, Bus seated/standing capacity, immutable Trip capacity and
topology snapshots, adjacent TripSegments, and status-free TripSeat inventory.
The old Route JSON and scalar Bus capacity are removed. A one-to-one legacy Seat
mirror remains only to keep pre-Phase-4 booking/driver screens buildable and is
not an Architecture v2 availability source.

## 13. Recommended next action

After Phase 4 PostgreSQL 16 CI is green, the next separate task is **Phase 5 —
passes, boarding, walk-ins, and alighting**. It must consume the reserved journey
allocations created here and must not rewrite planned allocation from actual
alighting evidence.
