# Manual Demo and Browser Checklist

Automated CI uses Chromium without physical webcam hardware. The owner must
complete the unchecked items on the actual demo laptop in the final venue or an
equivalent secure-context setup. Record browser version, date and outcome.

## Environment and startup

- [ ] PostgreSQL 16 is reachable; migrations and seed complete successfully.
- [ ] `.env` contains distinct non-demo secrets and the correct local URLs.
- [ ] `npm run dev` starts Next.js and `npm run realtime` reports healthy startup.
- [ ] `/health` on the realtime service responds and the application remains usable if Socket.io is stopped.

## Camera and fallback — current Chromium secure context

- [ ] Grant camera permission and confirm the scanner video appears.
- [ ] Confirm the camera preview initializes even when native `BarcodeDetector` is unavailable.
- [ ] Scan a valid Reserved or Walk-in QR with real camera hardware and confirm native detection or the maintained decoder fallback reaches the real server verification result.
- [ ] Deny camera permission and confirm an understandable denied state appears.
- [ ] Disable/unplug the camera and confirm an unavailable state appears.
- [ ] Confirm invalid, expired, wrong-Trip, FULL and already-boarded results are understandable where fixtures allow.
- [ ] Confirm the student pass exposes **Copy demo token** only as a clearly labelled Development / Demo aid, and the driver paste action remains secondary.

No successful hardware-camera result is claimed until these items are checked.

## Responsive and accessibility sanity

- [ ] Chrome/Chromium at desktop widths near 1280 and 1440 px.
- [ ] Mobile widths 320, 375, 390 and 430 px without page-level horizontal overflow.
- [ ] Browser zoom at 200% remains usable; zoom is not disabled.
- [ ] Keyboard-only navigation reaches portals, tabs, forms, dialogs and actions.
- [ ] Modal focus enters, cycles, closes with Escape where appropriate, and returns to its trigger.
- [ ] Focus indicators remain visible and reduced-motion preference is respected.

## Demo integrity

- [ ] Reset/reseed immediately before rehearsal and confirm documented accounts.
- [ ] The catalogue shows ten directional source-based Routes, no retired ring/block placeholders, and no synthetic Trip time is called official.
- [ ] GPS surfaces state **Simulated GPS / Prototype** and show freshness/no-data honestly.
- [ ] Walk-in Pass states that boarding is not guaranteed.
- [ ] Rehearse both individual module handoffs without claiming sole coding ownership.
- [ ] Keep a fallback plan: manual boarding and normal HTTP refresh if camera or Socket.io is unavailable.

The decoder is designed for current Chromium/Edge and Firefox-compatible camera
APIs, but only browsers actually checked above may be claimed in the viva.
Safari camera behavior, formal WCAG conformance and large-scale load testing are
outside the verified evidence.
