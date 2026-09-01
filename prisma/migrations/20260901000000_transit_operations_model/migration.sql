-- Transit operations model: ServiceLine -> directional Route -> Trip, plus
-- same-Bus ServiceBlocks. This migration intentionally performs no deletes.

BEGIN;

-- CreateEnum
CREATE TYPE "RouteDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateTable
CREATE TABLE "ServiceLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLine_code_key" ON "ServiceLine"("code");

-- Add nullable Route classification before deterministic backfill.
ALTER TABLE "Route" ADD COLUMN "lineId" TEXT;
ALTER TABLE "Route" ADD COLUMN "direction" "RouteDirection";

-- Stable prototype identifiers are explicit migration data; they do not rely
-- on Prisma's client-side uuid() generation.
INSERT INTO "ServiceLine" ("id", "code", "name", "createdAt", "updatedAt") VALUES
  ('00000000-0000-4000-8000-000000000001', 'WANGSA_MAJU', 'TAR UMT ↔ Wangsa Maju Section 2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000002', 'TERATAI', 'TAR UMT ↔ Teratai Residency', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000003', 'GENTING_KLANG', 'TAR UMT ↔ Jalan Genting Klang', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000004', 'MELATI_UTAMA', 'TAR UMT ↔ Melati Utama', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000005', 'PV_CORRIDOR', 'TAR UMT ↔ PV10/PV12/PV13 Corridor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Fail safely if a non-empty existing database contains a Route outside the
-- ten explicitly approved prototype directional names. No fallback Line is
-- assigned and NOT NULL is not enforced in that case.
DO $$
DECLARE
  unknown_routes TEXT;
BEGIN
  SELECT string_agg(format('%s (%s)', "name", "id"), ', ' ORDER BY "name", "id")
    INTO unknown_routes
    FROM "Route"
   WHERE "name" NOT IN (
     'Wangsa Maju Section 2 → TAR UMT',
     'TAR UMT → Wangsa Maju Section 2',
     'Teratai Residency → TAR UMT',
     'TAR UMT → Teratai Residency',
     'Jalan Genting Klang → TAR UMT',
     'TAR UMT → Jalan Genting Klang',
     'Melati Utama → TAR UMT',
     'TAR UMT → Melati Utama',
     'PV10/PV12/PV13 corridor → TAR UMT',
     'TAR UMT → PV10/PV12/PV13 corridor'
   );

  IF unknown_routes IS NOT NULL THEN
    RAISE EXCEPTION 'Unmapped Route rows prevent ServiceLine backfill: %', unknown_routes;
  END IF;
END $$;

-- Exact ten-name mapping.
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000001', "direction" = 'INBOUND'
 WHERE "name" = 'Wangsa Maju Section 2 → TAR UMT';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000001', "direction" = 'OUTBOUND'
 WHERE "name" = 'TAR UMT → Wangsa Maju Section 2';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000002', "direction" = 'INBOUND'
 WHERE "name" = 'Teratai Residency → TAR UMT';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000002', "direction" = 'OUTBOUND'
 WHERE "name" = 'TAR UMT → Teratai Residency';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000003', "direction" = 'INBOUND'
 WHERE "name" = 'Jalan Genting Klang → TAR UMT';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000003', "direction" = 'OUTBOUND'
 WHERE "name" = 'TAR UMT → Jalan Genting Klang';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000004', "direction" = 'INBOUND'
 WHERE "name" = 'Melati Utama → TAR UMT';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000004', "direction" = 'OUTBOUND'
 WHERE "name" = 'TAR UMT → Melati Utama';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000005', "direction" = 'INBOUND'
 WHERE "name" = 'PV10/PV12/PV13 corridor → TAR UMT';
UPDATE "Route" SET "lineId" = '00000000-0000-4000-8000-000000000005', "direction" = 'OUTBOUND'
 WHERE "name" = 'TAR UMT → PV10/PV12/PV13 corridor';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Route" WHERE "lineId" IS NULL OR "direction" IS NULL) THEN
    RAISE EXCEPTION 'ServiceLine backfill incomplete; Route classification remains nullable';
  END IF;
END $$;

ALTER TABLE "Route" ALTER COLUMN "lineId" SET NOT NULL;
ALTER TABLE "Route" ALTER COLUMN "direction" SET NOT NULL;

CREATE INDEX "Route_lineId_idx" ON "Route"("lineId");
CREATE INDEX "Route_lineId_direction_deletedAt_idx" ON "Route"("lineId", "direction", "deletedAt");

ALTER TABLE "Route"
  ADD CONSTRAINT "Route_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "ServiceLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceBlock" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "busId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceBlock_serviceDate_code_key" ON "ServiceBlock"("serviceDate", "code");
CREATE UNIQUE INDEX "ServiceBlock_id_busId_key" ON "ServiceBlock"("id", "busId");
CREATE INDEX "ServiceBlock_busId_serviceDate_idx" ON "ServiceBlock"("busId", "serviceDate");

ALTER TABLE "ServiceBlock"
  ADD CONSTRAINT "ServiceBlock_busId_fkey"
  FOREIGN KEY ("busId") REFERENCES "Bus"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Add optional block membership to existing Trips without rewriting any Trip
-- snapshots or passenger/history data.
ALTER TABLE "Trip" ADD COLUMN "blockId" TEXT;
ALTER TABLE "Trip" ADD COLUMN "blockSequence" INTEGER;

ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_block_membership_check"
  CHECK (
    ("blockId" IS NULL AND "blockSequence" IS NULL)
    OR ("blockId" IS NOT NULL AND "blockSequence" IS NOT NULL AND "blockSequence" > 0)
  );

CREATE INDEX "Trip_blockId_idx" ON "Trip"("blockId");
CREATE UNIQUE INDEX "Trip_blockId_blockSequence_key" ON "Trip"("blockId", "blockSequence");

-- The composite FK guarantees that a block Trip always uses the same physical
-- Bus as its ServiceBlock. A mismatch is rejected; neither Bus is rewritten.
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_blockId_busId_fkey"
  FOREIGN KEY ("blockId", "busId") REFERENCES "ServiceBlock"("id", "busId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
