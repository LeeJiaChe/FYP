# Phase 1 Verification Baseline

Status: **Architecture v2 safety net; no product/schema migration**

## Standard commands

| Command | Purpose | Expected local behavior |
|---|---|---|
| `npm run lint` | Zero-warning gate for new Architecture v2 source and Phase 1 verification code | Must pass |
| `npm run lint:legacy` | Full-repository diagnostic for inherited lint debt | May fail until scheduled migration/cleanup |
| `npm run typecheck` | One strict TypeScript check using the Next-compatible project config | Must pass |
| `npm test` / `npm run test:unit` | Pure executable Architecture v2 behavior specifications | Must pass |
| `npm run test:architecture` | Dependency-rule fixtures and scan of all `src/` code | Must pass |
| `npm run test:integration` | Safety validation plus a real PostgreSQL connectivity/identity test | Must pass only with the isolated test environment configured |
| `npm run build` | Next.js production build | Must pass where required build resources are available |
| `npm run verify` | Fast non-database Phase 1 gate: lint, typecheck, unit, architecture | Must pass |

## Legacy lint baseline

The Phase 0 audit measured 167 errors and 60 warnings across the prototype. Phase
1 does not hide or mass-fix that debt: `lint:legacy` continues to expose it. The
standard `lint` gate is deliberately scoped to `src/` plus the new tests and
safety scripts, uses `--max-warnings=0`, and cannot acquire new debt. As legacy
files move into Architecture v2, they enter this zero-warning scope. The full
legacy count must not be presented as green CI evidence.

## Test levels in Phase 1

- Unit/specification tests define target journey, waitlist, pass, alighting, and
  source-neutral telemetry behavior using test-only reference policies. They do
  not claim those product features are implemented.
- Architecture tests exercise forbidden examples as well as scanning repository
  `src/` code, preventing a vacuous future guard.
- The PostgreSQL integration suite is presently a read-only boundary smoke test.
  Target concurrency integration tests cannot truthfully exist until their Phase
  3–5 tables and constraints exist.
- Browser E2E tooling is intentionally deferred until migrated user workflows
  provide a stable, truthful test target.

## PostgreSQL isolation contract

Integration execution requires all of the following:

1. explicit `TEST_DATABASE_URL` using `postgres:` or `postgresql:`;
2. a database name ending in `_test`;
3. a physical database target different from `DATABASE_URL`, when the latter
   exists (credentials and connection query parameters do not make the same
   host/database safe);
4. `TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION` acknowledgement.

There is no SQLite fallback. Future destructive fixture setup must call the same
guard before reset/migration/cleanup and may target only the verified test URL.

## Tooling choice

Node 20's built-in `node:test` runner plus the repository's existing `tsx` loader
is the Phase 1 runner. It supports TypeScript, async/concurrent tests, standard
reporting, and CI exit codes without adding DOM, browser, or duplicate transform
dependencies. Vitest was considered from the installed Next.js guide, but the
registry was unavailable during Phase 1 and its React/DOM helpers are not needed
for these suites.

## Observed Phase 1 results (2026-08-14)

| Check | Status | Evidence |
|---|---|---|
| `npm run verify` | PASS | Scoped lint, regenerated Next route types plus strict `tsc`, 10 behavior specifications, and architecture guard fixtures/scan completed successfully. |
| Database safety rejection tests | PASS | Missing test URL, SQLite, non-`_test` name, equal dev/test URLs, and missing acknowledgement were all rejected. |
| `npm run test:integration` with guarded local URL | BLOCKED BY ENVIRONMENT | Safety accepted only `fyp_bus_test`; Prisma then reported no PostgreSQL server at `127.0.0.1:5432`. No fallback or mutation occurred. CI provisions PostgreSQL 16. |
| `npm run lint:legacy` | FAIL — documented legacy debt | 155 errors and 54 warnings remain, chiefly explicit `any`, React effect/purity rules, unused code, and CommonJS scripts. Phase 1 intentionally does not mass-fix these. |
| `npm run build` | BLOCKED BY ENVIRONMENT | The external Google font dependency was removed, then sandboxed Turbopack was denied permission to bind its internal process port. |
| `npx next build --webpack` | PASS | Production compilation, TypeScript, page-data collection, and all 32 static/dynamic route outputs completed. This is diagnostic evidence; the standard script remains the Next.js 16 default for CI. |
| GitHub Actions workflow | NOT RUN LOCALLY | CI is configured with PostgreSQL 16 and all standard gates; GitHub execution requires a push/PR. |

No Prisma schema, SQL migration, seed, or product feature was changed in Phase 1.
