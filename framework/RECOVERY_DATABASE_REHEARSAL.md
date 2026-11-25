# Round 1 database rehearsal and proposed shared rollout

The shared project is read-only during this round. The commands under Shared rollout require separate architectural authorization and an operator-controlled window.

## Shared baseline observed read-only

Supabase reported ACTIVE_HEALTHY on PostgreSQL 17.6. The seven completed Prisma migrations matched the committed SQL checksums. Neither September identity migration appeared in history. The shared User role counts were 10 Students, 2 Drivers, and 1 Admin. The assurance column was absent.

The public catalog contained 23 tables, 93 indexes, 32 check constraints, 49 foreign keys, and 23 primary keys. None of the checked tables granted effective SELECT, INSERT, UPDATE, or DELETE to anon or authenticated. RLS was disabled on the existing tables. There were no public ordinary or materialized views and no public functions in the queried catalogs. Default public table, sequence, and function grants for objects created by supabase_admin included anon and authenticated. The corresponding explicit defaults for the configured postgres role did not include those roles. Recheck effective grants and the executing role at rollout.

The configured Prisma connection uses postgres. It has BYPASSRLS, CREATEDB, and CREATE on public. It is not a PostgreSQL superuser or a member of supabase_admin. The browser authenticates to the application. Server-side Prisma is the database trust boundary. No direct browser Data API access was established for these tables. A narrower runtime role, separate from the migration owner, is a defense-in-depth follow-up to design and test against the full application.

## Reproduction and preservation

Run `TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION npm run test:rehearsal` from a credential-free checkout. The script provisions a private PostgreSQL cluster and verifies two databases independently. The clean database applies all nine original migrations and seeds the 10 canonical directional Routes and 13 Trip fixtures. The upgrade database applies the first seven original files with Prisma, then installs synthetic Users, topology, Trip snapshots, passenger history, waitlist, penalty, appeal, and notification rows. It recreates the observed live-only DDL.

- `Bus.assigned_driver_id` is nullable text with `Bus_assigned_driver_id_fkey`, UPDATE CASCADE and DELETE SET NULL.
- `Route.defaultDriverId` is required text with `Route_defaultDriverId_fkey`, UPDATE CASCADE and DELETE RESTRICT.
- Earlier local Git history includes the legacy feature work in `8bbd7ff` and `531b5f2`, and removal in `04601c6`. These are likely provenance. The exact operator and live DDL execution are unverified.
- The shared columns contain one Bus value and ten Route values. Rehearsal uses one synthetic value in each table. It compares complete projected fixture rows after the upgrade and a repeated deploy, including IDs, relationships, credit, session versions, existing notices, and legacy fields.
- Clean installation reports an existing Prisma representation diff, including FK names, the Route updatedAt default, the telemetry index definition, and two additional same-Trip TripSegment foreign keys. These differences are independent of identity and must not be blindly removed. The representative upgraded database has those differences plus the legacy assignment columns. Earlier live comparison against master reported only the two legacy columns and FKs. The rehearsal therefore represents verified legacy DDL and business records on the committed seven-migration schema.

The rehearsal applies both pending migrations in order, verifies identity RLS, uniqueness, staff login policy and reset eligibility, legacy Student assurance and session version, and nullable Google-only passwords. It simulates a late conflicting table on the disposable database, verifies rollback and retention of the old rows, then clears the synthetic obstruction and recovers using Prisma migration resolution. A repeated deploy makes no changes. This is synthetic evidence.

## Legacy reconciliation proposal

Leave both values and foreign keys intact. Subject to approval, drop only the Route legacy column's NOT NULL constraint. This lets the current Prisma application insert Routes without obsolete assignment values. Trip remains the sole assignment authority. The rehearsal verifies that every existing legacy value survives and that a new Route can omit the field. Prisma will continue reporting expected drift for both legacy columns and foreign keys. A later archive, relocation, or deletion requires a separate disposition decision. Restoring NOT NULL is possible only while no new rows have NULL or after an approved handling of those rows.

## Shared rollout after separate approval

1. Obtain a recoverable provider snapshot or encrypted logical backup. Verify restoration to a separate database. Record counts and integrity checks for passenger history, legacy associations, identity fields, and migration history. Export legacy metadata and values into the approved restricted backup.
2. Confirm shared target identity, active health, TLS, credential provenance, migration-owner permissions, the seven recorded checksums, existing exact legacy definitions and values, and expected differences. Stop on unexpected migration entries, failed history, drift, or write activity that cannot be coordinated.
3. Rehearse on the approved restored or synthetic disposable environment using PostgreSQL 17 as a staging parity check. Review the release SHA and have the architect approve the nullable legacy correction explicitly. Disable shared schedulers for the coordination window.
4. Apply only the approved legacy correction and committed identity migrations. From the pinned release checkout and an operator-supplied migration environment, run `npx --no-install prisma migrate status` and review the two expected pending migrations. The exact proposed legacy DDL is `ALTER TABLE "Route" ALTER COLUMN "defaultDriverId" DROP NOT NULL;`. Run `npx --no-install prisma migrate deploy` with the approved direct or session-mode target, then `npx --no-install prisma migrate status`. Do not feed a generated diff to PostgreSQL.
5. Confirm exactly nine completed migrations, matching checksums, three identity tables with RLS, effective grants and default privileges, preserved record counts and foreign keys, and unchanged legacy non-null counts. Then coordinate app deployment and authorized controlled staff/session smoke checks. Keep paid provider switches off until separately accepted.
6. Stop on a checksum or target mismatch, missing backup/restore evidence, unexpected grants, failed DDL, lost associations, or failed auth/data smoke checks. Keep the app on the previous supported release if compatible. Inspect database history and partial DDL before any migration resolution. Forward-recover with reviewed SQL, or restore the approved backup according to the outage/data-loss decision. Never run a shared reset, seed, or db push. After Google-only accounts exist, the previous password-only application may be incompatible, so application rollback must be explicitly evaluated.
