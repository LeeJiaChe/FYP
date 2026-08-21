# Final Dependency Audit

**Date:** 2026-08-22

No major-version upgrade was introduced. The final acceptance pass added two
small, concrete runtime dependencies; the lockfile remains the reproducible
authority for `npm ci`.

| Dependency group | Current concrete use |
|---|---|
| Next.js, React, React DOM | App Router website/runtime |
| Prisma CLI/client | PostgreSQL migrations, generation and persistence |
| Zod | Environment, identity, request and event contracts |
| bcryptjs, jsonwebtoken | Password hashing and signed session/pass/subscription tokens |
| server-only | Build-time protection for secret/Prisma server modules |
| Socket.io client/server, node-cron | Scoped invalidations and trusted scheduled triggers |
| qrcode | Dynamic pass QR rendering |
| qr-scanner | Maintained camera QR decoding when native `BarcodeDetector` is unavailable |
| @next/env | Loads the same root development environment for the standalone realtime process |
| lucide-react, react-hot-toast, Recharts | Icons, mutation feedback and bounded analytics charts |
| Tailwind/PostCSS | Website styling pipeline |
| TypeScript, tsx, ESLint and type packages | Build, seed/test execution and verification |

`@types/bcryptjs` is redundant with modern `bcryptjs` bundled declarations but
is harmless compatibility debt; removing it provides no release benefit and is
deferred rather than creating lockfile churn. Playwright remains installed
ephemerally at the pinned CI version, so the repository does not carry a second
browser framework.

Native `BarcodeDetector` is used where the browser supports QR detection.
`qr-scanner` supplies the maintained Web Worker decoder path where it does not,
while preserving the same signed-token server verification. The labelled demo
token fallback remains deterministic CI/manual recovery; hardware-camera
acceptance stays on the manual checklist.

The mounted workspace's existing `node_modules` can contain stale/extraneous
packages and is not release evidence. A clean `npm ci` and GitHub Actions run are
the authoritative dependency checks.
