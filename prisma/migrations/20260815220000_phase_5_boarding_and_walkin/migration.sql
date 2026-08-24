-- Phase 5: passes, standing admission, boarding/alighting evidence, and Trip progress.
--
-- Architecture v2 development data may be reset/reseeded. DELAYED was a legacy
-- lifecycle value and cannot be mapped truthfully to operational progress, so the
-- migration refuses ambiguous rows rather than inventing history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Trip" WHERE "status" = 'DELAYED') THEN
    RAISE EXCEPTION
      'Phase 5 cannot migrate Trip.status=DELAYED truthfully. Reset/reseed the approved development database first.';
  END IF;
END $$;

CREATE TYPE "AlightingMethod" AS ENUM ('QR', 'MANUAL', 'AUTO_PLANNED_STOP');
CREATE TYPE "WalkInIntentStatus" AS ENUM ('PENDING', 'BOARDED', 'REJECTED_FULL', 'EXPIRED', 'CANCELLED');
CREATE TYPE "WalkInJourneyStatus" AS ENUM ('BOARDED', 'COMPLETED');

BEGIN;
CREATE TYPE "TripStatus_new" AS ENUM ('NOT_STARTED', 'BOARDING', 'DEPARTED', 'ARRIVED', 'CANCELLED');
ALTER TABLE "Trip" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trip"
  ALTER COLUMN "status" TYPE "TripStatus_new"
  USING ("status"::text::"TripStatus_new");
ALTER TYPE "TripStatus" RENAME TO "TripStatus_old";
ALTER TYPE "TripStatus_new" RENAME TO "TripStatus";
DROP TYPE "TripStatus_old";
ALTER TABLE "Trip" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
COMMIT;

ALTER TABLE "Trip"
  ADD COLUMN "delayMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_delayMinutes_check" CHECK ("delayMinutes" >= 0);

ALTER TABLE "Booking"
  ADD COLUMN "actualAlightedAt" TIMESTAMP(3),
  ADD COLUMN "alightingMethod" "AlightingMethod";

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_alighting_evidence_check" CHECK (
    ("actualAlightedAt" IS NULL AND "alightingMethod" IS NULL)
    OR ("actualAlightedAt" IS NOT NULL AND "alightingMethod" IS NOT NULL)
  );

CREATE TABLE "WalkInIntent" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "boardingTripStopId" UUID NOT NULL,
  "dropOffTripStopId" UUID NOT NULL,
  "status" "WalkInIntentStatus" NOT NULL DEFAULT 'PENDING',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalkInIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalkInIntent_distinct_stops_check" CHECK ("boardingTripStopId" <> "dropOffTripStopId"),
  CONSTRAINT "WalkInIntent_expiry_check" CHECK ("expiresAt" > "issuedAt")
);

CREATE TABLE "WalkInJourney" (
  "id" TEXT NOT NULL,
  "walkInIntentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "boardingTripStopId" UUID NOT NULL,
  "dropOffTripStopId" UUID NOT NULL,
  "boardedAt" TIMESTAMP(3) NOT NULL,
  "boardingMethod" "CheckInMethod" NOT NULL,
  "status" "WalkInJourneyStatus" NOT NULL DEFAULT 'BOARDED',
  "actualAlightedAt" TIMESTAMP(3),
  "alightingMethod" "AlightingMethod",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalkInJourney_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalkInJourney_distinct_stops_check" CHECK ("boardingTripStopId" <> "dropOffTripStopId"),
  CONSTRAINT "WalkInJourney_alighting_evidence_check" CHECK (
    ("actualAlightedAt" IS NULL AND "alightingMethod" IS NULL AND "status" = 'BOARDED')
    OR ("actualAlightedAt" IS NOT NULL AND "alightingMethod" IS NOT NULL AND "status" = 'COMPLETED' AND "actualAlightedAt" >= "boardedAt")
  )
);

CREATE TABLE "StandingSegmentClaim" (
  "id" UUID NOT NULL,
  "walkInJourneyId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "tripSegmentId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StandingSegmentClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TripStatusHistory" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "fromStatus" "TripStatus" NOT NULL,
  "toStatus" "TripStatus" NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripStatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripStatusHistory_transition_check" CHECK ("fromStatus" <> "toStatus")
);

CREATE INDEX "WalkInIntent_studentId_status_expiresAt_idx"
  ON "WalkInIntent"("studentId", "status", "expiresAt");
CREATE INDEX "WalkInIntent_tripId_status_expiresAt_idx"
  ON "WalkInIntent"("tripId", "status", "expiresAt");
CREATE UNIQUE INDEX "WalkInIntent_tripId_id_studentId_boardingTripStopId_dropOff_key"
  ON "WalkInIntent"("tripId", "id", "studentId", "boardingTripStopId", "dropOffTripStopId");
CREATE UNIQUE INDEX "WalkInIntent_pending_journey_key"
  ON "WalkInIntent"("studentId", "tripId", "boardingTripStopId", "dropOffTripStopId")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "WalkInJourney_walkInIntentId_key" ON "WalkInJourney"("walkInIntentId");
CREATE INDEX "WalkInJourney_studentId_tripId_status_idx" ON "WalkInJourney"("studentId", "tripId", "status");
CREATE INDEX "WalkInJourney_tripId_status_idx" ON "WalkInJourney"("tripId", "status");
CREATE UNIQUE INDEX "WalkInJourney_tripId_id_key" ON "WalkInJourney"("tripId", "id");
CREATE UNIQUE INDEX "WalkInJourney_tripId_walkInIntentId_studentId_boardingTripS_key"
  ON "WalkInJourney"("tripId", "walkInIntentId", "studentId", "boardingTripStopId", "dropOffTripStopId");

CREATE INDEX "StandingSegmentClaim_tripId_tripSegmentId_idx"
  ON "StandingSegmentClaim"("tripId", "tripSegmentId");
CREATE INDEX "StandingSegmentClaim_walkInJourneyId_idx"
  ON "StandingSegmentClaim"("walkInJourneyId");
CREATE UNIQUE INDEX "StandingSegmentClaim_walkInJourneyId_tripSegmentId_key"
  ON "StandingSegmentClaim"("walkInJourneyId", "tripSegmentId");

CREATE INDEX "TripStatusHistory_tripId_occurredAt_idx" ON "TripStatusHistory"("tripId", "occurredAt");
CREATE INDEX "TripStatusHistory_actorId_occurredAt_idx" ON "TripStatusHistory"("actorId", "occurredAt");

ALTER TABLE "WalkInIntent"
  ADD CONSTRAINT "WalkInIntent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WalkInIntent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WalkInIntent_tripId_boardingTripStopId_fkey" FOREIGN KEY ("tripId", "boardingTripStopId") REFERENCES "TripStop"("tripId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WalkInIntent_tripId_dropOffTripStopId_fkey" FOREIGN KEY ("tripId", "dropOffTripStopId") REFERENCES "TripStop"("tripId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WalkInJourney"
  ADD CONSTRAINT "WalkInJourney_tripId_walkInIntentId_studentId_boardingTrip_fkey" FOREIGN KEY ("tripId", "walkInIntentId", "studentId", "boardingTripStopId", "dropOffTripStopId") REFERENCES "WalkInIntent"("tripId", "id", "studentId", "boardingTripStopId", "dropOffTripStopId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WalkInJourney_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WalkInJourney_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WalkInJourney_tripId_boardingTripStopId_fkey" FOREIGN KEY ("tripId", "boardingTripStopId") REFERENCES "TripStop"("tripId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WalkInJourney_tripId_dropOffTripStopId_fkey" FOREIGN KEY ("tripId", "dropOffTripStopId") REFERENCES "TripStop"("tripId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StandingSegmentClaim"
  ADD CONSTRAINT "StandingSegmentClaim_tripId_walkInJourneyId_fkey" FOREIGN KEY ("tripId", "walkInJourneyId") REFERENCES "WalkInJourney"("tripId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StandingSegmentClaim_tripId_tripSegmentId_fkey" FOREIGN KEY ("tripId", "tripSegmentId") REFERENCES "TripSegment"("tripId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TripStatusHistory"
  ADD CONSTRAINT "TripStatusHistory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TripStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
