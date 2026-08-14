# Phase 2 Shared Server Foundation

Status: **Implemented on `architecture-v2`; no Phase 3 schema migration**

Date: 2026-08-15

## Implemented boundaries

| Foundation | Concrete module | Why it exists |
|---|---|---|
| Server environment | `src/shared/config/server-environment.ts`, `env.server.ts` | Validates and separates PostgreSQL, session signing, QR signing, realtime service, and opt-in test settings without exposing values in errors. The accessor is server-only. |
| Product policy | `src/shared/config/policies.ts` | Owns all ten approved defaults with explicit units and supports narrow immutable test overrides. |
| Clock | `src/shared/time/clock.ts` | Gives booking/QR/no-show policies a system clock and deterministic fixed clock without a dependency-injection framework. |
| External UUID contract | `src/shared/types/uuid.ts` | Provides runtime UUID validation where external route/body identifiers need it; no scalar-wide branding scheme was added. |
| Student identity normalization | `src/shared/validation/student-identity.ts` | Enforces trim/lowercase and `@student.tarc.edu.my` for student email, plus trim/uppercase for Student ID, without inventing a local-part regex. |
| Prisma boundary | `src/shared/db/prisma.server.ts` | Is the only Architecture v2 `PrismaClient` constructor and preserves a development hot-reload singleton. Feature infrastructure may consume it later. |
| Typed errors | `src/shared/application/application-error.ts` | Defines the seven approved application error categories without coupling domain/use cases to HTTP. |
| HTTP error mapping | `src/shared/http/error-response.ts` | Maps typed/Zod errors once and ensures unexpected/internal details never enter responses. |
| Origin protection | `src/shared/http/origin-check.ts` | Applies same-origin rules compatible with cookie authentication and normal reverse-proxy forwarding. |
| Thin transport adapter | `src/shared/http/handle-route.server.ts` | Adds correlation IDs, same-origin mutation checking, bounded JSON/Zod parsing, one operation callback, and common error mapping—nothing resembling a generic router framework. |

## Environment contract

Required server settings are `DATABASE_URL`, `JWT_SECRET`, `QR_SECRET`,
`REALTIME_URL`, and `REALTIME_SERVICE_SECRET`. Database URLs must be PostgreSQL;
the three secrets must be distinct and at least 32 characters. QR no longer
falls back to the session secret. Errors identify variable names and constraints
but never echo values.

`TEST_DATABASE_URL` and `TEST_DATABASE_CONFIRM` are optional as a pair. If used,
the URL must target a PostgreSQL database ending in `_test`, differ from
`DATABASE_URL`, and use the Phase 1 acknowledgement. The Phase 1 command-line
guard remains authoritative before integration execution; there is still no
SQLite or development-database fallback.

`.env.example` documents server-only versus `NEXT_PUBLIC_*` values. Only the
public Socket.io URL is intended for browser bundling.

## Origin/CSRF decision

The app authenticates browsers with a JWT in an HTTP-only, `SameSite=Lax` cookie.
For defence in depth, current Proxy coverage now rejects browser `POST`, `PUT`,
`PATCH`, and `DELETE` requests under `/api` when `Origin` is missing, invalid, or
does not match the public request origin. Safe methods do not need the check.

For a direct deployment, public origin uses `Host` and the request URL protocol.
Behind a reverse proxy, it uses the first `X-Forwarded-Host` and
`X-Forwarded-Proto` values, matching Next.js guidance. The deployment proxy must
strip/overwrite client-supplied forwarded headers, and the Next.js origin should
not be exposed through an untrusted bypass.

The existing `/api/admin/cron/*` endpoints are machine-to-machine calls and are
the only current Proxy exemption; their handlers authenticate
`REALTIME_SERVICE_SECRET`. Future internal endpoints may bypass browser-origin
checking only through the explicit `trusted-service` adapter policy and must
authenticate their own service credential in the invoked use case.

## Security headers and trade-offs

`next.config.ts` applies:

- `Content-Security-Policy: base-uri 'self'; form-action 'self'; frame-ancestors
  'none'; object-src 'none'`;
- `X-Frame-Options: DENY` as a compatibility fallback;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` allowing camera only from self (required for final QR
  scanning) and disabling microphone, geolocation, and browsing topics.

The CSP intentionally does not claim full XSS source control. Next.js currently
uses framework scripts/styles and has statically rendered pages; adding strict
`script-src`/`style-src` safely would require a tested nonce/hash design and can
force dynamic rendering. A permissive copied policy would be fake security, so
that work is deferred. HSTS is also deferred until the final HTTPS domain and
subdomain policy are confirmed; enabling it on development hosts is harmful.

## Narrow legacy integration

The current `lib/auth.ts`, `lib/prisma.ts`, `lib/qr.ts`, and
`lib/realtime-client.ts` now declare `server-only`. Auth, QR, and realtime obtain
secrets from validated configuration. QR, booking restriction, initial credit,
and no-show deduction read the central policy. Registration/login reuse approved
student normalization.

This is not a feature migration. Legacy Route Handlers still own their existing
business logic and mostly import `lib/prisma.ts`; legacy session claims still
contain email/name; legacy cookie setup remains duplicated in login/register;
the realtime process still has its current structure; and old APIs remain active.
Those items migrate in their ordered feature phases rather than being rewritten
speculatively in Phase 2.

## Dependency enforcement

Architecture tests now scan real `src/shared` modules and enforce:

- only `src/shared/db/prisma.server.ts` may construct PrismaClient in V2 code;
- `.server.ts` files import `server-only`;
- Client Components cannot import `.server`, Prisma, DB, infrastructure, or
  feature server facades;
- shared code cannot import product features;
- domain code cannot import Next.js/React, read environment variables, or import
  Prisma;
- feature internals and Route Handler transport rules from Phase 1 remain active;
- sensitive legacy auth/Prisma/QR/realtime modules retain server-only markers
  until migrated.

## Phase boundary

No Prisma schema, SQL migration, seed, Stop/RouteStop/TripStop/TripSegment,
segment booking, walk-in, waitlist, or GPS telemetry implementation is included.
Phase 3 must begin as a separate change only after Phase 2 verification/CI is
accepted.

## Verification evidence

Observed on 2026-08-15:

| Check | Status | Evidence |
|---|---|---|
| `npm run lint` | PASS | The zero-warning Architecture v2 scope completed. A diagnostic over touched legacy adapters still reports inherited `any`/unused-value debt; these files remain outside the clean-scope claim until their migration phases. |
| `npm run lint:legacy` | FAIL — documented baseline | The repository-wide diagnostic remains at 155 errors and 54 warnings; Phase 2 does not disguise or mass-fix that debt. |
| `npm run verify` | PASS in writable diagnostic copy; BLOCKED at canonical workspace path | The unchanged standard command completed lint, Next route type generation, strict TypeScript, all nine unit/specification suites, and architecture tests in a disposable writable copy. In the mounted repository, Next cannot write `.next/types/routes.d.ts` because the canonical `/mnt/j/FYPBusSystem` path is read-only. |
| `npx tsc --noEmit --pretty false --incremental false` | PASS | This no-write fallback verifies the repository TypeScript graph at the mounted path; it does not replace the standard `next typegen` command. |
| `npm run test:unit` | PASS | Nine test files passed, including environment, error mapping, origin, policy/clock, identity, and Phase 1 domain specifications. |
| `npm run test:architecture` | PASS | The real `src/shared` scan and dependency-policy fixtures passed. |
| Database safety tests | PASS | Missing/unsafe targets, including the same physical database disguised by different credentials or Prisma query parameters, are rejected. |
| `npm run test:integration` | BLOCKED BY ENVIRONMENT | The command failed closed because no dedicated `TEST_DATABASE_URL` was provided; it did not fall back to or mutate the development database. |
| `npx prisma validate` | PASS | The unchanged PostgreSQL Prisma schema is valid. Prisma reports its existing package-level configuration deprecation for future cleanup. |
| `npm run build` | BLOCKED BY ENVIRONMENT | Next cannot create `.next/trace` at the canonical read-only workspace path. A writable-copy webpack diagnostic reached successful compilation and TypeScript, but the sandbox terminated before a complete production-build result; no PASS is claimed. |
| `git diff --check` and schema/migration diff guard | PASS | No whitespace defects and no Prisma schema, migration, or seed changes. |
| GitHub Actions | NOT OBSERVED | CI now targets `master` and `architecture-v2` and provisions PostgreSQL 16. This branch was not pushed as part of Phase 2, so no remote run exists to report. |

No dependency was added in Phase 2. Existing Zod, Prisma, Next.js `server-only`
handling, Node test runner, and `tsx` were sufficient.

The remaining pre-Phase-3 operational blocker is a reachable, explicitly
confirmed dedicated PostgreSQL `*_test` database (locally or through CI). The
workspace mount also needs a writable canonical path for a native local Next
build; neither limitation changes the checked-in commands.
