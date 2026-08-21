# Final Security Evidence

This register describes implemented controls, not certification.

| Boundary | Implemented evidence |
|---|---|
| Session | Signed JWT in HTTP-only `fyp_session` cookie; production cookie uses `secure`; server resolves live actor and role |
| Passwords | `bcryptjs` hashing; APIs and DTOs never return password hashes |
| Student identity | Email trim/lowercase and `@student.tarc.edu.my`; Student ID trim/uppercase without an invented local-part regex |
| Authorization | Feature use cases verify STUDENT/DRIVER/ADMIN and resource ownership; Driver operations compare assigned `Trip.driverId` with the live actor |
| Mutation origin | Shared same-origin validation rejects unsafe cross-origin browser mutations, including forwarded-host/protocol handling for normal proxies |
| Input size/shape | Zod request contracts and bounded JSON parsing; realtime `/emit` has an 8 KiB maximum and event whitelist |
| Secrets | Environment, Prisma, signing, and publishing internals use server-only boundaries; no secret is placed in `NEXT_PUBLIC_*` |
| QR passes | Signed, purpose-specific, 60-second Reserved/Walk-in/Alighting tokens; tokens are signed, not encrypted |
| QR trust | Signature/purpose/expiry is only the first check; PostgreSQL record, Trip, journey, actor, state and capacity are reread before mutation |
| Realtime | Short-lived signed subscription token scopes one authorized Trip room; emit requires service secret and minimal validated non-PII payload |
| Internal jobs/location | Trusted-service secret authenticates no-show reconciliation, retention, simulator and location ingestion |
| Privacy | Driver manifest and socket DTOs omit password, email, credit, penalty and unrelated passenger data |
| Database | Foreign keys, CHECK/UNIQUE/partial indexes, transactions, row/advisory locks and same-Trip composite identities protect invariants |
| Test safety | Integration runner requires a distinct PostgreSQL database ending `_test` and exact `FYP_BUS_INTEGRATION` confirmation |

## Known limitations

- This is not a penetration-tested or formally certified production system.
- Prototype accounts are not TAR UMT SSO and demo credentials must never be
  deployed.
- JWT/QR tokens are signed bearer tokens, not encrypted payloads; short expiry
  and idempotent database transitions reduce but cannot eliminate screenshot or
  device-compromise risk.
- HTTPS termination, HSTS, secret rotation, monitoring, backup/restore, rate
  limiting and institutional incident response require deployment-specific work.
- Native camera scanning depends on secure-context Chromium support; a labelled
  development/demo token fallback remains available.
- The prototype has no claim of zero-trust architecture or completed external
  security assessment.
