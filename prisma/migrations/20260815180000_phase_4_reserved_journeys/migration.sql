-- Phase 4 deliberately does not invent boarding/drop-off data for legacy
-- Booking rows. The owner approved a development reset/reseed.
DO $phase4$
BEGIN
  IF EXISTS (SELECT 1 FROM "Booking" LIMIT 1) THEN
    RAISE EXCEPTION
      'Phase 4 requires an approved development database reset before migration; legacy bookings have no truthful journey stops';
  END IF;
END
$phase4$;

-- Waitlisting is no longer a Booking lifecycle state.
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_legacy";
CREATE TYPE "BookingStatus" AS ENUM
  ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
ALTER TABLE "Booking"
  ALTER COLUMN "status" TYPE "BookingStatus"
  USING ("status"::text::"BookingStatus");
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
DROP TYPE "BookingStatus_legacy";

CREATE TYPE "WaitlistStatus" AS ENUM
  ('WAITING', 'PROMOTED', 'CANCELLED', 'EXPIRED');

-- Replace the whole-trip legacy Seat reference with an immutable TripSeat and
-- the passenger's snapshotted TripStop journey.
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_seatId_fkey";
DROP INDEX "Booking_seatId_key";
DROP INDEX "Booking_tripId_waitlistPosition_key";
DROP INDEX "Booking_studentId_idx";
DROP INDEX "Booking_tripId_idx";
ALTER TABLE "Booking"
  DROP COLUMN "seatId",
  DROP COLUMN "waitlistPosition",
  ADD COLUMN "tripSeatId" UUID NOT NULL,
  ADD COLUMN "boardingTripStopId" UUID NOT NULL,
  ADD COLUMN "dropOffTripStopId" UUID NOT NULL,
  ADD CONSTRAINT "Booking_distinct_journey_stops_check"
    CHECK ("boardingTripStopId" <> "dropOffTripStopId");

-- Composite identities are concrete integrity boundaries used by same-Trip
-- foreign keys. IDs remain globally unique primary keys.
CREATE UNIQUE INDEX "TripSeat_tripId_id_key"
  ON "TripSeat"("tripId", "id");
CREATE UNIQUE INDEX "TripSegment_tripId_id_key"
  ON "TripSegment"("tripId", "id");
CREATE UNIQUE INDEX "Booking_tripId_id_key"
  ON "Booking"("tripId", "id");
CREATE UNIQUE INDEX "Booking_tripId_id_tripSeatId_key"
  ON "Booking"("tripId", "id", "tripSeatId");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_tripSeat_same_trip_fkey"
    FOREIGN KEY ("tripId", "tripSeatId")
    REFERENCES "TripSeat"("tripId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Booking_boarding_stop_same_trip_fkey"
    FOREIGN KEY ("tripId", "boardingTripStopId")
    REFERENCES "TripStop"("tripId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Booking_drop_off_stop_same_trip_fkey"
    FOREIGN KEY ("tripId", "dropOffTripStopId")
    REFERENCES "TripStop"("tripId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Booking_studentId_tripId_status_idx"
  ON "Booking"("studentId", "tripId", "status");
CREATE INDEX "Booking_tripId_status_idx"
  ON "Booking"("tripId", "status");

-- A student may have at most one live reserved journey on a Trip. Completed,
-- cancelled and no-show history remains insertable and queryable.
CREATE UNIQUE INDEX "Booking_one_confirmed_student_trip_key"
  ON "Booking"("studentId", "tripId")
  WHERE "status" = 'CONFIRMED';

CREATE TABLE "ReservedSeatSegment" (
  "id" UUID NOT NULL,
  "bookingId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "tripSeatId" UUID NOT NULL,
  "tripSegmentId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReservedSeatSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservedSeatSegment_tripSeatId_tripSegmentId_key"
  ON "ReservedSeatSegment"("tripSeatId", "tripSegmentId");
CREATE UNIQUE INDEX "ReservedSeatSegment_bookingId_tripSegmentId_key"
  ON "ReservedSeatSegment"("bookingId", "tripSegmentId");
CREATE INDEX "ReservedSeatSegment_bookingId_idx"
  ON "ReservedSeatSegment"("bookingId");
CREATE INDEX "ReservedSeatSegment_tripId_tripSegmentId_idx"
  ON "ReservedSeatSegment"("tripId", "tripSegmentId");

ALTER TABLE "ReservedSeatSegment"
  ADD CONSTRAINT "ReservedSeatSegment_booking_seat_trip_fkey"
    FOREIGN KEY ("tripId", "bookingId", "tripSeatId")
    REFERENCES "Booking"("tripId", "id", "tripSeatId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ReservedSeatSegment_tripSeat_same_trip_fkey"
    FOREIGN KEY ("tripId", "tripSeatId")
    REFERENCES "TripSeat"("tripId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ReservedSeatSegment_tripSegment_same_trip_fkey"
    FOREIGN KEY ("tripId", "tripSegmentId")
    REFERENCES "TripSegment"("tripId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "boardingTripStopId" UUID NOT NULL,
  "dropOffTripStopId" UUID NOT NULL,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "promotedBookingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WaitlistEntry_distinct_journey_stops_check"
    CHECK ("boardingTripStopId" <> "dropOffTripStopId")
);

CREATE UNIQUE INDEX "WaitlistEntry_tripId_promotedBookingId_key"
  ON "WaitlistEntry"("tripId", "promotedBookingId");
CREATE INDEX "WaitlistEntry_tripId_status_queuedAt_idx"
  ON "WaitlistEntry"("tripId", "status", "queuedAt");
CREATE INDEX "WaitlistEntry_studentId_tripId_status_idx"
  ON "WaitlistEntry"("studentId", "tripId", "status");
CREATE UNIQUE INDEX "WaitlistEntry_one_waiting_journey_key"
  ON "WaitlistEntry"(
    "studentId", "tripId", "boardingTripStopId", "dropOffTripStopId"
  ) WHERE "status" = 'WAITING';

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WaitlistEntry_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WaitlistEntry_boarding_stop_same_trip_fkey"
    FOREIGN KEY ("tripId", "boardingTripStopId")
    REFERENCES "TripStop"("tripId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WaitlistEntry_drop_off_stop_same_trip_fkey"
    FOREIGN KEY ("tripId", "dropOffTripStopId")
    REFERENCES "TripStop"("tripId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WaitlistEntry_promoted_booking_same_trip_fkey"
    FOREIGN KEY ("tripId", "promotedBookingId")
    REFERENCES "Booking"("tripId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
