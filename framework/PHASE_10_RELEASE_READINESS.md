# Phase 10 — Release Readiness

**Status:** Release-candidate evidence prepared; final PostgreSQL 16, browser, and GitHub Actions evidence is recorded after publication.

**Date:** 2026-08-22

## Scope and product freeze

Phase 10 reconciles release documentation, deterministic demo data, setup instructions, diagrams, and verification evidence. It does not change the approved business rules, split the shared application by academic report scope, add a Prisma migration, or merge `architecture-v2` into `master`.

`APP_SPECIFICATION.md` remains the final product contract. `INDIVIDUAL_DOCUMENTATION_SCOPE.md` remains the canonical academic-scope boundary.

## Release candidate contents

- The final seed uses a small deterministic dataset for Student, Driver, and Admin demonstrations.
- Public stop and route-group names are limited to names verified on the TAR UMT Department of Student Affairs bus-route page.
- Every seeded route is labelled `Demo schedule:`. Coordinates, topology, travel durations, and Trip times are synthetic prototype data and are not represented as an official TAR UMT timetable.
- Demo credentials are isolated in `DEMO_ACCOUNTS.md` and explicitly marked development-only.
- `.env.example` documents development/deployment variables separately from isolated test-database variables and contains no real secrets.
- The README gives a fresh-clone path, including Prisma generation, ordered migrations, seeding, Next.js, realtime, simulator control, and verification commands.

## Database and migration state

The release candidate contains six forward migration directories:

1. initial migration;
2. Phase 3 topology and inventory;
3. Phase 4 reserved journeys;
4. Phase 5 boarding and walk-in;
5. Phase 6 no-show and penalties;
6. Phase 8 GPS/realtime analytics and legacy Seat/device removal.

There is no Phase 10 schema change or migration. Clean PostgreSQL verification must prove that migrations apply in order, Prisma reports the database current, the deterministic seed succeeds, all integration tests pass, and removed `Seat`, `DeviceStatusLog`, and `DeviceSignal` structures do not return.

## Evidence documents

- `FINAL_ERD.md`: final entities, cardinalities, and academic emphasis.
- `FINAL_RUNTIME_ARCHITECTURE.md`: browser, Next.js, PostgreSQL, realtime, and simulator boundaries.
- `FINAL_PASSENGER_SEQUENCES.md`: reserved booking, walk-in admission, no-show, and appeal flows.
- `FINAL_FLEET_SEQUENCES.md`: scheduling, progress, simulated GPS, and bus-unavailability flows.
- `FINAL_SECURITY_EVIDENCE.md`: implemented controls and limitations.
- `FINAL_CONCURRENCY_EVIDENCE.md`: PostgreSQL locking, constraints, and retry guarantees.
- `FINAL_TESTING_EVIDENCE.md`: verification layers and invariant coverage.
- `FINAL_SOURCE_REGISTER.md`: official, institutional, observation, and internal evidence classification.
- `FINAL_DEPENDENCY_AUDIT.md`: retained dependency purposes and deferred low-risk cleanup.
- `FINAL_DEMO_SCRIPT.md` and `FINAL_VIVA_GUIDE.md`: concise demonstration and defence handoffs.
- `MANUAL_DEMO_CHECKLIST.md`: intentionally manual camera, browser, responsive, zoom, keyboard, and focus checks.

## Verification evidence

### Local isolated-checkout diagnostics

The following passed in an isolated copy of the working tree using the repository's previously installed locked dependencies:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:architecture`
- `npx prisma validate`
- `npm run build -- --webpack`
- `git diff --check`

The ordinary Turbopack build could not follow the diagnostic checkout's deliberately external `node_modules` symlink; the webpack production build completed and generated all routes. This is an artifact of the isolated diagnostic layout, not an application failure. GitHub Actions performs the normal build with a clean in-workspace installation.

A local clean `npm ci` attempt was **blocked by environment** because the sandbox could not resolve the npm registry (`EAI_AGAIN`). No local PostgreSQL server is available. Consequently, clean installation, ordered migration, seed, PostgreSQL 16 integration, normal production build, and Playwright evidence are authoritative only when the final GitHub Actions job completes.

### Final CI evidence

The verified release-candidate commit, GitHub Actions run, exact test counts, migration status, and seed outcome are recorded here after the first published candidate completes CI. The final documentation-only evidence commit is reported in the release handoff because a commit cannot contain its own SHA.

## Performance sanity review

No release-blocking FYP-scale issue was found. Current protections include bounded notification and reconciliation queries, bounded analytics date ranges, limited realtime payloads, latest/bounded telemetry reads, and a 15-second location HTTP fallback rather than high-frequency authoritative polling. No Redis, cache tier, CDN, or load-testing claim is introduced. Large-scale load testing remains outside scope.

## Stale-reference audit

Active product code and current documentation were checked for PWA/install claims, removed Seat/device/IoT concepts, `DELAYED` as a lifecycle state, timetable-only no-show behavior, the superseded 30-minute cancellation cutoff, fake official routes, physical-GPS deployment claims, encrypted-QR claims, spreadsheet claims, old repository identity, and overclaims of full E2E coverage.

Remaining matches are intentional:

- historical phase/audit/migration evidence;
- explicit statements that PWA, sensors, devices, and ESP32 are removed or out of scope;
- canonical warnings not to claim current TAR UMT reservation/no-show behavior without evidence;
- technical explanations that QR tokens are signed rather than encrypted;
- prototype labels distinguishing simulated GPS from physical deployment.

No active product requirement or runtime dependency was found for the retired concepts.

## Manual owner tasks

Before the live assessment, the owner must complete the unchecked items in `MANUAL_DEMO_CHECKLIST.md` on the actual demo laptop and secure-origin Chromium browser. In particular, camera permission, `BarcodeDetector`, recognition using a real camera, narrow viewport sizes, browser zoom, keyboard navigation, and modal focus must not be claimed as manually verified until observed.

The owner should also rehearse `FINAL_DEMO_SCRIPT.md`, verify the projector/network/database environment, and approve the eventual merge to `master`.

## Known limitations

- GPS is explicitly simulated prototype telemetry; no physical device deployment is claimed.
- Camera support targets a current Chromium secure context; deterministic CI uses the labelled Development / Demo fallback and no webcam.
- JWT sessions are not institutional SSO.
- Email/SMS delivery, payment, offline/PWA behavior, transfer routing, circular routes, and seat sensors are outside scope.
- The prototype has not undergone penetration testing, formal accessibility certification, multi-browser camera certification, or large-scale load testing.
- Public route-group names do not make the synthetic seeded topology or timetable official university data.

## Merge readiness

`architecture-v2` is ready for owner review once the final GitHub Actions gate succeeds and its evidence is recorded. Phase 10 does not merge the branch. Merge to `master` requires explicit owner approval.
