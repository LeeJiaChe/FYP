# Round 2 final acceptance evidence

**Date:** 26 November 2026 MYT
**Review branch:** [release/recovery-r4-r6-final-acceptance](https://github.com/LeeJiaChe/FYP/tree/release/recovery-r4-r6-final-acceptance)
**Base:** `f9e2c69928eca4810b068690cab22abac8894e3f`
**Decision:** CONDITIONAL — SPECIFIC OPERATOR ACTIONS REMAIN.

The review candidate is for architectural acceptance and controlled staging. Shared rollout, institutional sign-in, Resend delivery and physical camera checks require independent evidence. The handoff accompanying the branch identifies the exact final candidate SHA and remote CI run. Verify the release branch ref and CI head SHA before use.

## Git and Round 1 preservation

The accepted [Round 1 Actions run](https://github.com/LeeJiaChe/FYP/actions/runs/45652187685) succeeded at the baseline SHA. Remote `develop` was `05d0046f772fe7a5361d16f8e06bebe3932f5885` and `master` was `38091a75d461cd733750594358062c83c7d30dcd` at assessment. The review branch descends from the accepted baseline. The nine migration files have identical checksums to the baseline. The existing capacity, scheduling and no-show lock order remains in force, as do the private cluster, exact URL, nonce, credential-free worktree, socket and live database identity checks.

## R4 authentication and provider acceptance

| Workflow | Implementation and automated evidence | Real environment status |
|---|---|---|
| Google Student SSO | Separate canonical email and Workspace `hd` checks. Verifier boundary, signed onboarding, account/role conflicts, unique subject and concurrent onboarding/legacy linkage covered. | **BLOCKED** until an approved OAuth client, Workspace claim and controlled account are available. |
| Staff password login and sessions | Admin/Driver fixture login and role boundaries covered. Public seed values blocked outside verified fixture. Minimal JWT, production cookie settings, logout and database revocation tested. | Disposable app verified. Hosted acceptance pending. |
| Staff reset | Hash, expiry, one-time concurrent consumption, old session invalidation, generic response, allowed-origin fragment generation and preview isolation tested. | **BLOCKED** for real Resend delivery until verified sender, access and approved recipient are available. |
| Google Routes | Server-only key, bounded timeout, local request budget, coalescing, 60-second polling, validation and timetable fallback tested with fake providers. | **DISABLED BY DESIGN** for this review. |
| Google Maps | Separate browser key setting and coordinate schematic fallback; simulated telemetry displayed in Chromium. | **DISABLED BY DESIGN** without approved Maps configuration. |
| Gemini | Admin-only read-only interpretation; deterministic server metrics remain authoritative. Structured outputs, provider errors, fallback and prompt data boundaries covered by existing tests. | **DISABLED BY DESIGN** without approved provider validation. |
| Socket.io | Signed Trip room subscriptions, expiry, unauthorized Driver rejection, disconnect/reconnect and cross-room delivery tested with the actual service. | Loopback verified. Persistent hosted service pending. |

The public reset body and status are generic. An actual provider submission can still affect latency, so an externally tested claim of timing indistinguishability would require further validation. Authentication rate limits use 25 login attempts per client per minute, 10 per client/identifier per five minutes and five registrations per client per minute. Public endpoints use a bounded fallback bucket until the designated ingress provides a valid overwritten client-IP header. Process limits are per replica and restart with the process. Apply central ingress limits on a scaled deployment.

Production mutations rely on the configured exact HTTPS application origin. The ingress must block direct access and canonicalize or strip forwarded headers. Student demo password use requires a verified fixture. Fixture staff passwords are rejected in shared operation. Actual staff sign-in after approved rotation remains an operator acceptance step. Session cookies are HttpOnly/Secure in production and SameSite=Lax. Sessions revalidate live role, eligibility and version. Trip and booking APIs enforce object authorization independent of browser navigation. QR claims remain signed, purpose-specific and short lived.

## R5 dependency register

Fresh baseline `npm audit` exited 1 with four high and seven moderate package findings, and no critical. The patch is lockfile-only. The present registry report after repair has zero findings. The advisory descriptions below identify the affected surface without reproducing the vulnerable behavior.

| Advisory | Baseline path and production reachability | Patched version and selected remediation |
|---|---|---|
| [GHSA-2gc4-cqfq-p2gv](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv) | `socket.io@4.8.3 → engine.io@6.6.9`; reachable on the public Socket.io transport before application-level room authorization. | Fixed at 6.6.10. Selected 6.6.13 within the existing Socket.io range. Compatibility verified through real connections. |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) and [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `eslint → minimatch → brace-expansion@1.1.18`; `eslint-config-next → typescript-eslint → typescript-estree → minimatch → brace-expansion@5.0.9`. Development lint pattern processing. The HTTP application does not accept these patterns. | 1.1.21/5.0.12 fix all listed ranges. Selected 1.1.22/5.1.0 and the compatible TypeScript ESLint family update that also resolves [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) via minimatch 11.0.9. Verify lint and typecheck. |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | `eslint → @eslint/eslintrc → js-yaml@4.3.1` and lint configuration paths. Development parsing. No application endpoint accepts YAML. | Fixed and selected 4.3.2. Compatible patch release. |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `next@16.4.6 → postcss → source-map-js@1.2.1` and Tailwind/PostCSS tooling. Present in the production dependency tree. No route processes user-supplied source maps. | Fixed at 1.2.2. Selected compatible 1.2.4 and verified Next build. |

The accepted baseline Actions API returned no job annotations. CI now uses current supported checkout/setup-node/upload-artifact v7 versions, the pinned application Node runtime, PostgreSQL 17, Chromium and audit gating. The Node.js version comes from `.nvmrc`.

## R5 role and rule acceptance

| Role | Automated fixture evidence | Acceptance still pending |
|---|---|---|
| Student | Booking and pass, From/To, service date, departure, seat selection and confirmation, full-Trip waitlist, walk-in intent and warning, appeal, history, simulated tracking, appearance and mobile interaction. Integration verifies cancellation, compatible FIFO promotion, standing limits, no-show and credit boundaries, own-data protections and operational cutoff. Signed/mocked Google evidence covers first and returning login paths. | Real institutional sign-in, hosted expired-session usability and manual review of notification and error states across the deployed flows. |
| Driver | Browser login, assigned Trip, start boarding, scanner UI and real manual boarding mutation; timetable and keyboard navigation at supported widths. PostgreSQL integration verifies role/object boundaries, stop transitions, valid and rejected passes, duplicate/manual equivalence, standing admission, explicit and automatic alighting, and completion. | Physical QR/device matrix and site-specific live operations. |
| Admin | Browser login, canonical routes, schedule creation and snapshots, appeal approval and responsive menu; integration verifies route/stop/fleet/block constraints, bulk workflow policies, resource conflicts and edit restrictions, analytics and Malaysia date boundaries. | Hosted operational walkthrough across all dashboard, analytics, filters and empty/error states. |

Seven days is the canonical reservation opening window. Trip stop progress decides closure and no-show. Capacity is per physical seat and segment. Compatible waitlist promotions and final standing capacity are transactional. QR and manual validation share server rules. Credit begins at 100, reserved no-show deducts 15 subject to available balance, and reservations are restricted below 40. Appeal restoration is idempotent. Departure reminder requirements remain ambiguous and the candidate adds no reminder subsystem.

Responsive browser evidence covers Student use at 320/375/390 px plus desktop fixtures. Staff navigation/layout is measured at 320/375/390/768/1440 px. The seat modal checks keyboard entry, Escape and focus return. Student appearance tests cover readability in Light and Dark. Physical touch, mobile camera, 200% zoom and formal WCAG/contrast certification require separate acceptance. The Driver layout and block status label received focused corrections.

## Realtime and device evidence

The browser runner starts actual Next.js and Socket.io processes bound to loopback against the verified database. Independent Chromium contexts authenticate, subscribe to different Trip rooms, reject unauthorized Driver scope, observe simulator-origin invalidations and read authoritative telemetry after interrupting and reconnecting. The Socket.io unit suite opens a real client connection and exercises expiry. Browser acceptance covers transport and API refetch on reconnection. Full manual observation of every portal update during a deployed network interruption remains pending. The separate interactive demo command enables one designated scheduler for one disposable database. Camera controls and fallback were tested in Chromium. A physical camera remains an explicit operator check. GPS is simulated.

## R6 database, rehearsal and release gate

Read-only shared evidence on 26 November 2026 confirmed project ref `mtvcsfljmodzfinukqor`, management status `ACTIVE_HEALTHY`, and PostgreSQL 17.6. All seven completed migration checksums matched the corresponding repository SQL. No failed/rolled-back history records were present. The two identity migrations remained pending. Shared counts observed were 13 Users, 3 Buses, 10 Routes, 13 Trips, 6 Bookings, 1 WaitlistEntry, 0 admitted Walk-in Journeys, 3 Penalties, 1 Appeal and 8 Notifications. One non-null Bus assignment and ten non-null Route defaults each joined to an existing User.

`Bus_assigned_driver_id_fkey` references `User(id)` with ON UPDATE CASCADE and ON DELETE SET NULL. `Route_defaultDriverId_fkey` references `User(id)` with ON UPDATE CASCADE and ON DELETE RESTRICT. `Route.defaultDriverId` was NOT NULL. Shared catalog evidence was 23 public tables with RLS disabled, zero public views/functions and no effective checked CRUD grants to anon/authenticated. `supabase_admin` defaults included anonymous and authenticated table, sequence and function grants. Prisma currently connects as privileged postgres with CREATEDB and BYPASSRLS. A narrower server-side role was verified against representative transactions without these privileges. Keep it separate from the migration role and validate the full application before adopting it on shared infrastructure. Consult the [runtime proposal and exact rollout procedure](../docs/DEPLOYMENT_AND_RECOVERY.md).

PostgreSQL 17.12 rehearsal used synthetic data with both exact legacy FK shapes and counts of one Bus and ten populated Routes. It verified the clean deploy, seven-to-nine upgrade, separate synthetic restore and upgrade, active checksum equality, late DDL rollback and forward recovery, no-op repeated deployment, repeated reconciliation, identity RLS and new Route creation under the narrower role. Shared encrypted backup, real restore and operator maintenance approval remain **BLOCKED**. The proposed shared writes are the two pending Prisma migrations and one nullability correction. Alternate runtime grants require their own review. No shared database writes occurred.

## Verification, deployment and academic records

The fixture test suite increased from 381 to 394 total assertions (279 unit/specification, 20 architecture, 79 PostgreSQL integration and 16 browser tests). The verification commands, selected versions and credentials policy are in the [deployment runbook](../docs/DEPLOYMENT_AND_RECOVERY.md). See the accompanying release handoff for final-head local and remote results. The [academic passenger evidence](LEE_JIA_CHE_PASSENGER_EVIDENCE.md) includes requirements traceability, use cases, ERD, sequences, concurrency and proposed Chapter 3 and Chapter 4 outlines. The common [runtime diagram](FINAL_RUNTIME_ARCHITECTURE.md), [demo script](FINAL_DEMO_SCRIPT.md), [viva guide](FINAL_VIVA_GUIDE.md), and [manual checklist](MANUAL_DEMO_CHECKLIST.md) identify the role boundaries and remaining checks.

## Operator checklist

- Confirm the approved Workspace claim, provision the staging OAuth Web client and complete the controlled Student flow. Verify the sender domain, authorize the recipient, and witness a real staff reset and credential rotation.
- Provide the controlled hosting environment, HTTPS origin, persistent Socket.io service, secret configuration and scheduler owner. Leave optional provider flags closed unless their configuration and calls are expressly approved.
- Obtain a recoverable encrypted shared backup or provider snapshot, prove a separate controlled restore, agree on the maintenance window and authorize the exact shared writes after reviewing prerequisites.
- Run physical camera acceptance, mobile touch/zoom checks and the hosted role walkthrough. Record environment, build and outcomes without private identifiers or credentials.
- Give final publication and release approval only after verifying the candidate SHA and CI and closing the outstanding gates.

## Safety record

Actions in the shared project were read-only. The branch publication was authorized for review. No production hosting or paid provider requests, unauthorized live mail, shared seed/reset/db push, credential disclosures, historical migration edits, branch deletion, forced push, merge or pull request are part of this handoff.
