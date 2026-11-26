-- Apply only after the migration and legacy preservation preflight.
-- psql -X --set=ON_ERROR_STOP=1 --file=prisma/operations/reconcile-legacy-route.sql
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $reconcile$
DECLARE
  legacy_attnum smallint;
  legacy_required boolean;
BEGIN
  IF to_regclass('public."Route"') IS NULL THEN
    RAISE EXCEPTION 'Route table missing. Apply Prisma migrations first.';
  END IF;

  LOCK TABLE public."Route" IN ACCESS EXCLUSIVE MODE;
  SELECT attnum, attnotnull INTO legacy_attnum, legacy_required
  FROM pg_attribute
  WHERE attrelid = 'public."Route"'::regclass
    AND attname = 'defaultDriverId' AND NOT attisdropped;

  -- A clean nine-migration installation has no legacy column.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Route"'::regclass
      AND conname = 'Route_defaultDriverId_fkey'
      AND contype = 'f'
      AND convalidated
      AND conkey = ARRAY[legacy_attnum]
      AND confrelid = 'public."User"'::regclass
      AND pg_get_constraintdef(oid) =
        'FOREIGN KEY ("defaultDriverId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE RESTRICT'
  ) THEN
    RAISE EXCEPTION 'Unexpected legacy Route foreign key. Review the catalog before continuing.';
  END IF;

  IF legacy_required THEN
    ALTER TABLE public."Route" ALTER COLUMN "defaultDriverId" DROP NOT NULL;
  END IF;
END
$reconcile$;

COMMIT;
