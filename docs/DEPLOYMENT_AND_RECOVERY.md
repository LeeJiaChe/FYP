# Round 2 deployment and database recovery

The release candidate consists of one Next.js application, one durable PostgreSQL database and one persistent Socket.io service. The repository does not name an approved hosting account or public release origin. Run all examples below with the candidate from the review branch, and record the exact SHA, hostnames, runtime health, operator and date in the release record.

## Isolated rehearsal and interactive demo

Use a credential-free checkout, Node 24.22.3, Chromium for browser tests and PostgreSQL 17 client/server tools first on PATH. Verify `pg_config --bindir` identifies the 17 installation. Supply no project dotenv files to the disposable tooling.

```sh
npm ci
npx --no-install prisma generate
TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION FYP_REQUIRE_POSTGRES_17=true npm run test:rehearsal
TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION npm run test:integration
TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION npm run test:e2e
TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION npm run demo:fixture
```

The last command is optional for the interactive demo. It prints a private loopback URL and starts one Socket.io process with one scheduler, using generated fixture secrets and synthetic data. Stop with Ctrl+C. Every run provisions and verifies a private Unix-socket cluster before seed or mutation. Automated browser tests use the real realtime process, with periodic jobs disabled for deterministic test data. Direct simulator requests also target that verified fixture.

## Deployment configuration

| Component | Required deployment configuration |
|---|---|
| Next.js | Build with the pinned Node version and reviewed lockfile. Set the browser-facing realtime URL at build time. Start with `npm run start` behind HTTPS. Use the exact HTTPS origin in `APP_BASE_URL`. Check `GET /api/health` for readiness. An unreachable database yields 503. |
| HTTPS ingress | Allow only the application hostname. Keep the application listener private. For per-IP throttling, replace the incoming `X-FYP-Client-IP` with the ingress's authenticated client address and set `TRUST_FYP_CLIENT_IP=true`. Configure ingress rate limits on authentication and bounded request sizes. This is required for horizontally scaled deployments because process counters reset on restart and are local to each instance. |
| Socket.io | Run `npm run realtime` in a persistent Node process supporting WebSocket upgrade and heartbeat timeouts. Set `REALTIME_HOST`, `REALTIME_PORT`, exact `CORS_ORIGIN`, private `NEXTJS_INTERNAL_URL`, and the shared realtime secret. Check `GET /health`. Keep `POST /emit` on a private route where feasible. Use a single process for this release because the in-memory adapter does not broadcast across replicas. |
| Scheduler | Start with `RUN_SCHEDULED_JOBS=false`. After controlled acceptance, designate exactly one realtime instance for no-show reconciliation, location retention and simulated GPS. Disable other instances and operators' schedulers. |
| Database | Store the application role DSN in the runtime secret store. Use a separate migration-owner DSN only in the operator environment. Use provider-supported TLS and verify endpoint/project identity, session pooling behavior and connection caps. |
| Secrets and logs | Generate distinct random JWT, QR and realtime secrets of at least 32 characters. Keep provider keys server-side except the purpose-specific browser Maps key and public Google Web Client ID. Keep authentication request bodies, credentials, pass tokens, reset fragments, connection strings and provider payloads out of ingress and application logs. |
| Optional providers | Start with Routes and Gemini flags off and no Maps browser key. Enable Google Student SSO or Resend only after the controlled checks in the authentication setup. Review separate Maps/Routes key restrictions, quotas and current terms before requesting authorization to enable paid integrations. |

No staff account with a public seed password can sign in outside a verified fixture. Arrange a secure staff credential rotation before deployment. Keep both demo flags off in hosted environments. Camera access on a physical phone requires the actual HTTPS deployment and device permissions.

## Shared database change gate

The repository contains nine historical Prisma migrations and two SQL operations. The approved reconciliation is a separately run constraint correction. The optional runtime grants are a separate change with their own review. A clean database skips the legacy column operation.

Complete all of the following before seeking shared-write approval:

1. Record candidate SHA, exact successful CI run, PostgreSQL 17 rehearsal, shared project identity, migration checksums, effective privileges and exact legacy constraints.
2. Record read-only aggregate counts and validate passenger relationships and the populated legacy Bus and Route foreign keys. Repeat near the maintenance window.
3. Take a recoverable encrypted backup or provider snapshot, verify retention and access controls and restore it to a separate controlled target. Rehearse the exact release on that target. A synthetic restore does not satisfy this gate.
4. Confirm the staff authentication path, fallback and credential rotation. Confirm application compatibility, pause shared schedulers and agree with the owner on the maintenance window and what stops rollout.
5. Obtain explicit written owner approval for the two pending Prisma migrations, the legacy nullability operation and any separately approved permission changes.

Run these commands only in an owner-authorized operator shell with credentials injected privately. Use `DATABASE_URL` for Prisma and a driver-compatible `PGSERVICE`/libpq connection for psql, both to the same verified migration-owner target. Keep shell tracing disabled.

```sh
npx --no-install prisma migrate status
npx --no-install prisma migrate deploy
psql -X --set=ON_ERROR_STOP=1 --file=prisma/operations/reconcile-legacy-route.sql
npx --no-install prisma migrate status
```

The reconciliation takes a bounded lock on `public."Route"`, checks the existing legacy foreign key and drops only the column's `NOT NULL` flag. Verify all nine active checksums and no unexpected history records, correct identity columns and RLS, both preserved legacy foreign keys and value populations, and relevant passenger/operational counts and relationships. Review Prisma's documented schema representation differences and legacy columns rather than applying its generated diff. Verify Route creation on an explicitly authorized controlled case, staff login and Student linkage before reopening traffic or enabling the scheduler.

If a migration fails, stop traffic activation, retain logs without credentials and inspect Prisma history and the actual schema. The synthetic rehearsal reproduced a rolled-back DDL failure, then used `prisma migrate resolve --rolled-back` after removing the synthetic cause and deployed forward. For a live failure use that state transition only after confirming the transaction did roll back. If the database cannot be advanced safely, restore to a separate target, verify the restoration and agree on traffic cutover with the owner. After successful additive identity migration, prefer a compatible previous application build or reviewed forward fix over undoing migrations. Reinstating the historical Route constraint after new null Route rows exist requires separate reconciliation and approval.

## Runtime database privileges

`prisma/operations/provision-runtime-grants.sql` is a proposal verified with a distinct disposable login. It applies explicit table-level privileges and narrowly scoped RLS policies for the application's three identity/token tables. The runtime role does not own tables, does not read migration history and does not receive CREATE, CREATEDB, CREATEROLE or BYPASSRLS. The application enforces end-user role and object authorization. The PostgreSQL role represents the trusted application server and its identity policies do not model individual students.

On an approved controlled Supabase target, have the owner create the unprivileged NOLOGIN `fyp_app_runtime` group and a dedicated inheriting login using the secret manager. Confirm neither role inherits owner or API roles. Review default privileges and execute the grant operation once as the table owner. Re-run application acceptance using the actual runtime connection before considering shared adoption. The fixture rehearse verifies identity/token queries, staff lookup, row/advisory locks and Route creation. Full privilege coverage with a dedicated runtime login is still pending. Apply future grants explicitly as schema changes require.

The app uses server-side Prisma and has no browser Data API dependency. Disable the Supabase Data API if the owner confirms there are no other consumers. If it is needed by another consumer, limit it to a dedicated approved schema, revoke inherited public exposure of this app's tables/routines, and review defaults per creating role. Do not use Supabase Auth claims as a substitute for the app's authorization policy.

- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Supabase Prisma connection guidance](https://supabase.com/docs/guides/database/prisma)
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase backup and restore](https://supabase.com/docs/guides/platform/backups)
