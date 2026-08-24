-- Phase 6: authoritative reserved no-shows, bounded credit, penalties, appeals,
-- and notification idempotency.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE "creditScore" < 0 OR "creditScore" > 100
  ) THEN
    RAISE EXCEPTION
      'Phase 6 requires User.creditScore in the approved 0..100 range.';
  END IF;

  IF EXISTS (
    SELECT "bookingId"
    FROM "Penalty"
    GROUP BY "bookingId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 6 requires at most one Penalty per reserved Booking. Reset incompatible demo data or reconcile duplicates first.';
  END IF;
END $$;

CREATE TYPE "PenaltyType" AS ENUM ('RESERVED_NO_SHOW');

ALTER TABLE "User"
  DROP COLUMN "isBookingRestricted";

ALTER TABLE "User"
  ADD CONSTRAINT "User_creditScore_check"
  CHECK ("creditScore" >= 0 AND "creditScore" <= 100);

ALTER TABLE "Booking"
  DROP COLUMN "qrTokenIssuedAt";

ALTER TABLE "Penalty"
  ADD COLUMN "type" "PenaltyType" NOT NULL DEFAULT 'RESERVED_NO_SHOW';

ALTER TABLE "Notification"
  ADD COLUMN "deduplicationKey" TEXT;

DROP INDEX "Penalty_bookingId_idx";
DROP INDEX "Penalty_studentId_idx";

CREATE UNIQUE INDEX "Penalty_bookingId_key" ON "Penalty"("bookingId");
CREATE INDEX "Penalty_studentId_createdAt_idx" ON "Penalty"("studentId", "createdAt");
CREATE INDEX "Penalty_status_createdAt_idx" ON "Penalty"("status", "createdAt");
CREATE INDEX "PenaltyAppeal_studentId_createdAt_idx" ON "PenaltyAppeal"("studentId", "createdAt");
CREATE INDEX "PenaltyAppeal_status_createdAt_idx" ON "PenaltyAppeal"("status", "createdAt");
CREATE INDEX "Booking_boardingTripStopId_status_checkedInAt_idx"
  ON "Booking"("boardingTripStopId", "status", "checkedInAt");
CREATE UNIQUE INDEX "Notification_deduplicationKey_key"
  ON "Notification"("deduplicationKey");

DROP INDEX "PenaltyAppeal_studentId_idx";

ALTER TABLE "Penalty" DROP CONSTRAINT "Penalty_bookingId_fkey";
ALTER TABLE "Penalty" DROP CONSTRAINT "Penalty_studentId_fkey";
ALTER TABLE "PenaltyAppeal" DROP CONSTRAINT "PenaltyAppeal_penaltyId_fkey";
ALTER TABLE "PenaltyAppeal" DROP CONSTRAINT "PenaltyAppeal_studentId_fkey";

ALTER TABLE "Penalty"
  ADD CONSTRAINT "Penalty_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Penalty_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PenaltyAppeal"
  ADD CONSTRAINT "PenaltyAppeal_penaltyId_fkey"
    FOREIGN KEY ("penaltyId") REFERENCES "Penalty"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PenaltyAppeal_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
