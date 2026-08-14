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

The existing root `app/`, `components/`, and `lib/` tree is audited legacy code.
It is intentionally not grandfathered into `src/`, and it remains covered by the
documented migration plan rather than weakening the Architecture v2 rules.
