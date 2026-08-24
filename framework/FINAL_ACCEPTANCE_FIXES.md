# Final Acceptance Fixes

**Status:** Final acceptance implementation published; exact final SHA and
GitHub Actions evidence are recorded in the acceptance handoff.

**Date:** 2026-08-22

## Accepted corrections

- The deterministic seed now contains exactly ten directional Route catalogue
  records across the current published Wangsa Maju, Teratai Residency, Jalan
  Genting Klang, Melati Utama and PV10/PV12/PV13 corridor families. Source-based
  route/stop identity is distinct from thirteen synthetic relative-time Trip
  snapshots and prototype coordinates. PV15/PV16 are not active Stops.
- Retired ring-shuttle/Main Gate/Block placeholder topology was removed from
  active UI. Student route summaries and tracking consume database snapshots.
- Driver camera preview and decoding no longer depend exclusively on the
  experimental `BarcodeDetector`. Native detection may be used, with
  `qr-scanner` as the browser decoder fallback; both call the unchanged signed
  token verification endpoint. Media tracks stop during cleanup and accepted
  scans suppress duplicate verification.
- Student Reserved and Walk-in pass dialogs expose a clearly labelled
  Development/Demo token-copy action where demo mode is enabled.
- Theme preference supports System, Light and Dark semantics with light-mode
  contrast repairs across shared utility colors while retaining the visual
  identity.
- Driver progress copy uses lifecycle and operational-stop state; ARRIVED can
  no longer appear as “not started.”
- `npm run realtime` loads root development environment files through
  `@next/env` before retaining the existing minimum-secret validation.
- A scheduled GPS simulator tick with no eligible operational Trip is an
  expected successful no-op. An explicitly requested missing/ineligible Trip
  remains a real error; working simulation/ingestion behavior is unchanged.
- Reservation and waitlist mutations now provide concise post-navigation
  success feedback.

## Preserved boundaries

No Prisma schema, migration, architecture, or approved booking/boarding/
penalty/fleet/GPS business rule changed. QR tokens remain short-lived and
signed—not encrypted—and camera decoding never replaces server authorization.
IoT seat/device monitoring remains removed.

## Acceptance gate

The acceptance candidate contains 77 unit/specification assertions, 11
architecture assertions, 61 real-PostgreSQL integration assertions and 10
Chromium browser scenarios. The clean CI gate also performs dependency install,
Prisma generation/validation, all six migrations, fresh deterministic seed,
typecheck and production build. Its exact pushed SHA and GitHub Actions run are
reported in the final acceptance handoff because a commit cannot record its own
SHA or the run it triggers.
