-- Phase 8: source-neutral location telemetry and removal of obsolete
-- whole-trip Seat/device simulation state.

CREATE TYPE "LocationSource" AS ENUM ('SIMULATED', 'GPS');

CREATE TABLE "TripLocationSample" (
  "id" UUID NOT NULL,
  "tripId" TEXT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "LocationSource" NOT NULL,

  CONSTRAINT "TripLocationSample_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripLocationSample_latitude_check"
    CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "TripLocationSample_longitude_check"
    CHECK ("longitude" BETWEEN -180 AND 180)
);

CREATE INDEX "TripLocationSample_tripId_recordedAt_idx"
  ON "TripLocationSample"("tripId", "recordedAt" DESC);
CREATE INDEX "TripLocationSample_recordedAt_idx"
  ON "TripLocationSample"("recordedAt");

ALTER TABLE "TripLocationSample"
  ADD CONSTRAINT "TripLocationSample_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "DeviceStatusLog";
DROP TABLE "Seat";
DROP TYPE "DeviceSignal";
DROP TYPE "SeatStatus";
