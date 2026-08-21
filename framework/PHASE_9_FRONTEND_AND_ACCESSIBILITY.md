# Phase 9 — Frontend Composition, Responsive UX, Accessibility, and Scope Cleanup

**Status:** Implemented; Phase 10 has not started.  
**Date:** 2026-08-21  
**Schema impact:** None. No Prisma schema or migration was added or changed by Phase 9.

## Outcome

The existing Architecture v2 behavior is presented as one coherent responsive
website. Business rules from Phases 3–8 remain unchanged. Student, Driver, Admin,
and Settings routes now use small Server Component shells to resolve the session
and pass a privacy-limited current-user contract into focused Client Component
portals.

## Portal composition and UI ownership

- `app/student/page.tsx`, `app/driver/page.tsx`, `app/admin/page.tsx`, and
  `app/settings/page.tsx` are server/session composition boundaries.
- Booking UI is owned by `src/features/bookings/ui`.
- Pass/scanner and Driver operations UI is owned by
  `src/features/boarding/ui`.
- Stops, Routes, Buses, and the Admin shell are owned by
  `src/features/fleet/ui`; scheduling UI is owned by `src/features/trips/ui`.
- GPS tracking/live monitoring is owned by `src/features/location/ui`.
- Penalty/appeal UI is owned by `src/features/penalties/ui`; charts are owned by
  `src/features/analytics/ui`.
- The generic Navbar, confirmation dialog, Modal, and SeatGrid remain shared
  components because they have concrete cross-feature consumers.

The full App Router remains at root `app/`. Next.js 16 supports either root
`app` or `src/app`; moving every page and API handler offered no URL or runtime
benefit and would have created a large mechanical regression surface. The
repository therefore does not split routing between two App Router roots.

## Product-scope cleanup

- Removed `app/manifest.ts`, manifest/Apple install metadata, install icons, and
  PWA-only icon-generation scripts. Normal favicon and responsive metadata
  remain. There is no service worker.
- Removed fake Settings controls for account deletion, data export, 2FA,
  privacy toggles, notification preferences, language, compact mode, forced
  animation, and high-contrast preferences. Profile, password, and working
  theme controls remain.
- Removed the drift-prone root `types/index.ts`. Current user and Trip-list
  contracts now live with shared UI or the owning feature.
- Moved `useAuth` to the identity feature as `useCurrentUser` and removed the
  redundant `/api/auth/me` request when a Server Component already supplied the
  user. The generic Trip hook moved to the Trips feature.
- `lib/auth.ts`, `lib/prisma.ts`, `lib/validations.ts`, and
  `lib/realtime-client.ts` remain intentional compatibility boundaries because
  still-active legacy Route Handlers consume them. Their final migration is not
  mixed into this UI phase.

## Truthful core UX

- Reservation ordering is `From → To → Date → Departure → Seat`; internal
  TripSegment terminology is absent from the student flow.
- Reserved Passes state that a confirmed booking guarantees the selected seat.
  Walk-in Passes use a distinct visual/word contract and state that capacity is
  checked only when the Driver scans the pass.
- Pass views show kind, route, journey, seat where relevant, QR expiry/countdown,
  and automatic refresh. They avoid implementation language about JWTs.
- Exit QR wording describes optional operational evidence, not a capacity
  requirement.
- Camera scanning remains primary. Native `BarcodeDetector` is used when the
  browser supports it; permission-denied, unavailable-camera, unsupported,
  invalid, expired, wrong-Trip, full, and duplicate results have explicit
  states. Token paste is inside a disclosure labelled
  **Development / Demo fallback**.
- GPS surfaces say **Simulated GPS / Prototype**, display the persisted sample
  time/freshness, and show an honest no-data/stale state. No schedule
  interpolation fallback exists.

## Accessibility and responsive behavior

- The shared Modal provides dialog semantics, labelled title, initial focus,
  Tab containment, Escape close, focus restoration, backdrop consistency, and
  body-scroll locking.
- Forms received visible associated labels, names/autocomplete where applicable,
  mutation loading/disabled states, and readable server errors.
- Tabs expose tab semantics and selected state. Menus expose names, expanded
  state, controlled menu IDs, and Escape behavior.
- Global `:focus-visible` styling makes keyboard focus visible. Native buttons
  and controls replace non-semantic click targets in core flows.
- Browser zoom is no longer restricted: `maximum-scale=1` and
  `user-scalable=no` were removed.
- Non-essential animation/transition behavior respects
  `prefers-reduced-motion`.
- Narrow-layout rules cover 320–430 px modal sizing, touch targets, wrapping,
  and tab overflow. Large tables use bounded horizontal containers rather than
  causing page-level overflow. Desktop content remains max-width constrained.
- Portal loading files, a root recoverable error boundary, and not-found output
  prevent blank core states.

This is accessibility improvement evidence, not a claim of WCAG certification.

## Browser E2E design

Playwright uses one Chromium runner and the dedicated PostgreSQL test database.
CI fail-closes through `verify-test-database.ts`, resets/migrates the test DB,
seeds deterministic scenarios, and starts the normal Next.js website. The suite
covers:

1. student `From → To → Date → Departure → Seat` composition and Reserved Pass;
2. seeded truthful WAITING, Walk-in non-guarantee, penalty, and appeal states;
3. Driver assigned-Trip/scanner surface and explicit demo fallback;
4. Admin fleet/scheduling/monitoring/analytics/appeal surfaces;
5. simulated-GPS label and honest freshness/no-data behavior; and
6. 320 px page overflow and keyboard-closing dialog regression checks.

Camera E2E deliberately does not depend on a physical webcam. CI verifies the
camera-first UI and deterministic fallback boundary. Final manual demo testing
should use a current secure-context Chromium browser with `BarcodeDetector`
support and grant camera permission; the fallback remains available when that
platform API is unavailable.

## Lint and remaining frontend debt

All Architecture v2 domain/application/infrastructure code retains strict lint
rules. A narrow ESLint override permits `any` only inside migrated
`src/features/**/ui/*.tsx` compatibility projections. These components consume
several legacy JSON API shapes that have not yet been converted to complete
feature DTOs. This debt is isolated and must not spread into server/domain code.

## Stale-reference classification

- Normative documents may state that PWA, device/sensor, physical GPS hardware,
  and account deletion/export are out of scope; those are intentional negative
  requirements.
- initial/historical migrations retain removed enum/table history and are not
  rewritten.
- `ARCHITECTURE_AUDIT_2026-08-14.md`, phase reports, `AUDIT_LOG.md`, the proposal
  extraction, and `ui_ux_audit_findings.md` are historical evidence and may
  describe superseded scope. They are not active product claims.
- The disabled `/api/auth/account` compatibility endpoint states explicitly that
  self-service deletion is unavailable; no UI calls it.

## Phase 10 boundary

Phase 10 should perform final documentation/citation verification, capture
repeatable demo and accessibility evidence, rehearse the role-based scenario,
and reconcile historical proposal wording. It must not reopen Phase 3–8 domain
rules or present the simulated GPS source as physical hardware.
