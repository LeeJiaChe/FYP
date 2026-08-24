# Architecture v2 dependency guardrails

`npm run test:architecture` checks both rule fixtures and every source file under
`src/`. The fixture cases ensure the guard does not pass vacuously before the
Phase 9 source move begins.

The guard enforces:

- no Prisma/database import in feature `domain` or `ui`;
- no cross-feature internal imports (use another feature's `public` or `server`
  facade);
- no server, infrastructure, or Prisma import from a `use client` module;
- no Prisma, transactions, domain/application/infrastructure imports in App
  Router Route Handlers; they delegate to feature server facades.
- only `src/shared/db/prisma.server.ts` constructs PrismaClient for Architecture
  v2 code;
- `.server.ts` modules explicitly import `server-only`;
- shared code cannot import features, and domain code cannot import Next/React or
  read environment variables.

The existing root `app/`, `components/`, and most of `lib/` remain audited legacy
code. Phase 2 additionally verifies `server-only` markers on current auth,
Prisma, QR, and realtime publisher internals while leaving their feature
migration for later phases.
