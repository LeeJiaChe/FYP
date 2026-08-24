-- Phase 3 intentionally requires a reset/reseed of the demo database.
-- Legacy Route JSON and Booking/Seat rows cannot be converted into truthful
-- passenger journeys because they do not contain boarding/drop-off stops.
DO $phase3$
BEGIN
  IF EXISTS (SELECT 1 FROM "Route" LIMIT 1)
    OR EXISTS (SELECT 1 FROM "Trip" LIMIT 1)
    OR EXISTS (SELECT 1 FROM "Seat" LIMIT 1)
    OR EXISTS (SELECT 1 FROM "Booking" LIMIT 1) THEN
    RAISE EXCEPTION
      'Phase 3 requires an approved development database reset before migration; legacy route/trip/booking data is not migrated';
  END IF;
END
$phase3$;

-- Bus capacity is now explicit and future Trips snapshot both values.
ALTER TABLE "Bus" RENAME COLUMN "capacity" TO "seatedCapacity";
ALTER TABLE "Bus" ADD COLUMN "standingCapacity" INTEGER;
UPDATE "Bus" SET "standingCapacity" = 0;
ALTER TABLE "Bus" ALTER COLUMN "standingCapacity" SET NOT NULL;
ALTER TABLE "Bus"
  ADD CONSTRAINT "Bus_seatedCapacity_check" CHECK ("seatedCapacity" > 0),
  ADD CONSTRAINT "Bus_standingCapacity_check" CHECK ("standingCapacity" >= 0);

-- Normalized Route topology replaces the JSON column.
ALTER TABLE "Route" DROP COLUMN "stops";
ALTER TABLE "Route"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD CONSTRAINT "Route_name_check"
    CHECK (char_length(btrim("name")) BETWEEN 2 AND 120 AND "name" = btrim("name"));

CREATE TABLE "Stop" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Stop_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Stop_code_check"
    CHECK (char_length("code") BETWEEN 1 AND 32 AND "code" = btrim("code")),
  CONSTRAINT "Stop_name_check"
    CHECK (char_length("name") BETWEEN 1 AND 120 AND "name" = btrim("name")),
  CONSTRAINT "Stop_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "Stop_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180)
);

CREATE TABLE "RouteStop" (
  "id" UUID NOT NULL,
  "routeId" TEXT NOT NULL,
  "stopId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "travelDurationToNextMinutes" INTEGER,

  CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RouteStop_position_check" CHECK ("position" >= 0),
  CONSTRAINT "RouteStop_travelDuration_check"
    CHECK ("travelDurationToNextMinutes" IS NULL OR "travelDurationToNextMinutes" > 0)
);

CREATE UNIQUE INDEX "Stop_code_key" ON "Stop"("code");
CREATE UNIQUE INDEX "RouteStop_routeId_position_key"
  ON "RouteStop"("routeId", "position");
CREATE UNIQUE INDEX "RouteStop_routeId_stopId_key"
  ON "RouteStop"("routeId", "stopId");

ALTER TABLE "RouteStop"
  ADD CONSTRAINT "RouteStop_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "Route"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RouteStop_stopId_fkey"
    FOREIGN KEY ("stopId") REFERENCES "Stop"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing Trips are absent because of the reset guard; new values are required.
ALTER TABLE "Trip"
  ADD COLUMN "seatedCapacity" INTEGER,
  ADD COLUMN "standingCapacity" INTEGER;
UPDATE "Trip" AS trip
SET
  "seatedCapacity" = bus."seatedCapacity",
  "standingCapacity" = bus."standingCapacity"
FROM "Bus" AS bus
WHERE bus."id" = trip."busId";
ALTER TABLE "Trip"
  ALTER COLUMN "seatedCapacity" SET NOT NULL,
  ALTER COLUMN "standingCapacity" SET NOT NULL,
  ADD CONSTRAINT "Trip_seatedCapacity_check" CHECK ("seatedCapacity" > 0),
  ADD CONSTRAINT "Trip_standingCapacity_check" CHECK ("standingCapacity" >= 0),
  ADD CONSTRAINT "Trip_arrival_after_departure_check"
    CHECK ("estimatedArrivalTime" > "departureTime");

CREATE INDEX "Trip_routeId_departureTime_idx"
  ON "Trip"("routeId", "departureTime");
CREATE INDEX "Trip_driverId_departureTime_idx"
  ON "Trip"("driverId", "departureTime");

CREATE TABLE "TripStop" (
  "id" UUID NOT NULL,
  "tripId" TEXT NOT NULL,
  "stopId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "stopCode" TEXT NOT NULL,
  "stopName" TEXT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "plannedArrival" TIMESTAMP(3) NOT NULL,
  "plannedDeparture" TIMESTAMP(3) NOT NULL,
  "boardingDeadline" TIMESTAMP(3) NOT NULL,
  "actualArrival" TIMESTAMP(3),
  "actualDeparture" TIMESTAMP(3),
  "passedAt" TIMESTAMP(3),

  CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripStop_position_check" CHECK ("position" >= 0),
  CONSTRAINT "TripStop_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "TripStop_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
  CONSTRAINT "TripStop_planned_times_check"
    CHECK ("plannedArrival" <= "plannedDeparture" AND "plannedDeparture" <= "boardingDeadline")
);

CREATE UNIQUE INDEX "TripStop_tripId_position_key"
  ON "TripStop"("tripId", "position");
CREATE UNIQUE INDEX "TripStop_tripId_stopId_key"
  ON "TripStop"("tripId", "stopId");
CREATE UNIQUE INDEX "TripStop_tripId_id_key"
  ON "TripStop"("tripId", "id");
CREATE INDEX "TripStop_stopId_plannedDeparture_idx"
  ON "TripStop"("stopId", "plannedDeparture");

ALTER TABLE "TripStop"
  ADD CONSTRAINT "TripStop_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TripStop_stopId_fkey"
    FOREIGN KEY ("stopId") REFERENCES "Stop"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TripSegment" (
  "id" UUID NOT NULL,
  "tripId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "fromTripStopId" UUID NOT NULL,
  "toTripStopId" UUID NOT NULL,

  CONSTRAINT "TripSegment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripSegment_position_check" CHECK ("position" >= 0),
  CONSTRAINT "TripSegment_distinct_stops_check"
    CHECK ("fromTripStopId" <> "toTripStopId")
);

CREATE UNIQUE INDEX "TripSegment_tripId_position_key"
  ON "TripSegment"("tripId", "position");
CREATE UNIQUE INDEX "TripSegment_tripId_fromTripStopId_toTripStopId_key"
  ON "TripSegment"("tripId", "fromTripStopId", "toTripStopId");

ALTER TABLE "TripSegment"
  ADD CONSTRAINT "TripSegment_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TripSegment_fromTripStopId_fkey"
    FOREIGN KEY ("fromTripStopId") REFERENCES "TripStop"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TripSegment_toTripStopId_fkey"
    FOREIGN KEY ("toTripStopId") REFERENCES "TripStop"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TripSegment_from_same_trip_fkey"
    FOREIGN KEY ("tripId", "fromTripStopId") REFERENCES "TripStop"("tripId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TripSegment_to_same_trip_fkey"
    FOREIGN KEY ("tripId", "toTripStopId") REFERENCES "TripStop"("tripId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TripSeat" (
  "id" UUID NOT NULL,
  "tripId" TEXT NOT NULL,
  "seatNumber" INTEGER NOT NULL,

  CONSTRAINT "TripSeat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripSeat_seatNumber_check" CHECK ("seatNumber" > 0)
);

CREATE UNIQUE INDEX "TripSeat_tripId_seatNumber_key"
  ON "TripSeat"("tripId", "seatNumber");

ALTER TABLE "TripSeat"
  ADD CONSTRAINT "TripSeat_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Temporary Phase 3 compatibility bridge. Booking still references legacy Seat
-- until Phase 4; every new legacy row maps one-to-one to authoritative TripSeat.
ALTER TABLE "Seat" ADD COLUMN "tripSeatId" UUID;
CREATE UNIQUE INDEX "Seat_tripSeatId_key" ON "Seat"("tripSeatId");
ALTER TABLE "Seat"
  ADD CONSTRAINT "Seat_tripSeatId_fkey"
    FOREIGN KEY ("tripSeatId") REFERENCES "TripSeat"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
