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

If `DATABASE_URL` is set, it must point somewhere different. The Phase 1 smoke
test is read-only because the Architecture v2 schema does not exist yet. Future
schema integration fixtures may reset only the verified `_test` database, must
reuse `verifyTestDatabaseEnvironment`, and must never run destructive setup from
an unverified `DATABASE_URL`.
