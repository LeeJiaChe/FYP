# Retired prototype checks

The former root-level scripts were retired in Phase 1:

- `auth-security.test.ts`
- `phase1-2-3-fixes.test.ts`
- `phase4-e2e.test.ts`
- `phase5-ui-logic.test.ts`
- `test-utils.ts`

They asserted source-code substrings, depended on a running application without a
managed fixture lifecycle, directly mutated Prisma in an alleged E2E path, and
included a stale assertion for removed `middleware.ts`. Their historical findings
remain in `framework/ARCHITECTURE_AUDIT_2026-08-14.md`; they are not trustworthy
verification gates.

Replacement suites are executable behavior specifications, Architecture v2
dependency tests, and a fail-closed real-PostgreSQL integration boundary. Browser
E2E tooling should be added only when migrated product workflows exist to test.
