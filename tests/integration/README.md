# Disposable PostgreSQL verification

Use a clean, credential-free Linux or WSL checkout with the Node version in
`.nvmrc`, PostgreSQL 16 server binaries, `psql`, and `pg_config`. The fixture
commands reject checkout dotenv files and run children with an allowlisted
environment. They never use an operator-provided database URL.

```sh
npm ci
npx --no-install prisma generate
npx --no-install playwright install chromium
TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION npm run test:integration
TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION npm run test:rehearsal
TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION npm run test:e2e
```

Each command creates a new mode-0700 directory and PostgreSQL cluster with
TCP disabled. Only a private Unix socket is used. PostgreSQL requires a unique
SCRAM password for the fixture owner. A separate nonce marker is installed in
each fixture database. Before deployment, seeding, or application startup, the
runner verifies the exact intended Prisma URL, private path ownership and
permissions, and PostgreSQL's current database, role, data directory, transport,
and nonce. The acknowledgement alone confers no access. The post-run cleanup
stops the cluster and removes the directory. If an OS-level kill interrupts
cleanup, inspect the exact private fixture path before removing it. Do not
operate on another PostgreSQL cluster.

Integration uses `prisma migrate deploy` on a fresh database. The browser
runner deploys and atomically seeds a separate fresh database. `npm run db:seed`
requires proof from an active provisioned fixture. Running it with normal
development settings refuses before the first write. Browser tests select a
fresh loopback port, verify the database before starting Next.js, and reject
server reuse. Demo Student login and QR controls are enabled only in the browser
child environment. Schedulers, external providers, and email preview are off.

GitHub CI publishes diagnostic HTML on browser failure. CI traces and
screenshots are disabled because they can retain session cookies or encoded
boarding passes. Local traces remain available with disposable fixtures.
