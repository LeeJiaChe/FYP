# PostgreSQL integration-test boundary

Integration tests use a dedicated PostgreSQL database and fail closed. They never
fall back to `DATABASE_URL` and never use SQLite.

To run them locally, create a disposable database whose name ends in `_test`, then
set both safeguards explicitly:

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fyp_bus_test" \
TEST_DATABASE_CONFIRM="FYP_BUS_INTEGRATION" \
npm run test:integration
```

If `DATABASE_URL` is set, it must point somewhere different. The runner refuses
an unconfirmed/non-`_test` URL, resets only the verified database, applies every
Prisma migration, reports migration status, and then executes the integration
suite. Fixtures must reuse `verifyTestDatabaseEnvironment` and must never run
destructive setup from an unverified `DATABASE_URL`.

Phase 3 is the first phase with real schema integration coverage. PostgreSQL 16
CI is the authoritative fallback when a local execution environment does not
permit PostgreSQL sockets; SQLite is not supported.
