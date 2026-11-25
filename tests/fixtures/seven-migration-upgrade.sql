-- Synthetic reproduction of the two additional shared columns and their actual foreign keys.
INSERT INTO "User" (id, "studentId", name, email, "passwordHash", role, "sessionVersion", "updatedAt")
VALUES ('upgrade-student', 'UPGRADE001', 'Synthetic Student', 'upgrade@student.tarc.edu.my', 'fixture-student', 'STUDENT', 4, now()),
       ('upgrade-driver', NULL, 'Synthetic Driver', 'driver@example.test', 'fixture-driver', 'DRIVER', 5, now()),
       ('upgrade-admin', NULL, 'Synthetic Admin', 'admin@example.test', 'fixture-admin', 'ADMIN', 6, now());
INSERT INTO "Bus" (id, "plateNumber", "seatedCapacity", "standingCapacity")
VALUES ('upgrade-bus', 'UPGRADE-1', 2, 1);
INSERT INTO "Route" (id, name, "lineId", direction, "updatedAt")
SELECT 'upgrade-route', 'Synthetic Upgrade Route', id, 'OUTBOUND', now() FROM "ServiceLine" ORDER BY id LIMIT 1;
ALTER TABLE "Bus" ADD COLUMN assigned_driver_id text
    CONSTRAINT "Bus_assigned_driver_id_fkey" REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "Route" ADD COLUMN "defaultDriverId" text
    CONSTRAINT "Route_defaultDriverId_fkey" REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
UPDATE "Bus" SET assigned_driver_id = 'upgrade-driver' WHERE id = 'upgrade-bus';
UPDATE "Route" SET "defaultDriverId" = 'upgrade-driver' WHERE id = 'upgrade-route';
ALTER TABLE "Route" ALTER COLUMN "defaultDriverId" SET NOT NULL;

INSERT INTO "Stop" (id, code, name, latitude, longitude, "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000011', 'UP-A', 'Synthetic A', 3, 101, now()),
       ('00000000-0000-4000-8000-000000000012', 'UP-B', 'Synthetic B', 4, 102, now());
INSERT INTO "RouteStop" (id, "routeId", "stopId", position, "travelDurationToNextMinutes")
VALUES ('00000000-0000-4000-8000-000000000013', 'upgrade-route', '00000000-0000-4000-8000-000000000011', 0, 10),
       ('00000000-0000-4000-8000-000000000014', 'upgrade-route', '00000000-0000-4000-8000-000000000012', 1, NULL);
INSERT INTO "Trip" (id, "routeId", "busId", "driverId", "departureTime", "estimatedArrivalTime", "boardingDeadline",
                    "seatedCapacity", "standingCapacity", status, "updatedAt")
VALUES ('upgrade-trip', 'upgrade-route', 'upgrade-bus', 'upgrade-driver', '2026-09-01 00:00',
        '2026-09-01 00:10', '2026-09-01 00:05', 2, 1, 'ARRIVED', now());
INSERT INTO "TripStop" (id, "tripId", "stopId", position, "stopCode", "stopName", latitude, longitude,
                       "plannedArrival", "plannedDeparture", "boardingDeadline", "actualArrival", "actualDeparture")
VALUES ('00000000-0000-4000-8000-000000000021', 'upgrade-trip', '00000000-0000-4000-8000-000000000011', 0,
        'UP-A', 'Synthetic A', 3, 101, '2026-09-01 00:00', '2026-09-01 00:00', '2026-09-01 00:05', '2026-09-01 00:00', '2026-09-01 00:06'),
       ('00000000-0000-4000-8000-000000000022', 'upgrade-trip', '00000000-0000-4000-8000-000000000012', 1,
        'UP-B', 'Synthetic B', 4, 102, '2026-09-01 00:10', '2026-09-01 00:10', '2026-09-01 00:15', '2026-09-01 00:15', NULL);
INSERT INTO "TripSegment" (id, "tripId", position, "fromTripStopId", "toTripStopId")
VALUES ('00000000-0000-4000-8000-000000000023', 'upgrade-trip', 0, '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022');
INSERT INTO "TripSeat" (id, "tripId", "seatNumber")
VALUES ('00000000-0000-4000-8000-000000000024', 'upgrade-trip', 1);
INSERT INTO "Booking" (id, "studentId", "tripId", "tripSeatId", "boardingTripStopId", "dropOffTripStopId", status, "updatedAt")
VALUES ('upgrade-booking', 'upgrade-student', 'upgrade-trip', '00000000-0000-4000-8000-000000000024',
        '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022', 'NO_SHOW', now());
INSERT INTO "WaitlistEntry" (id, "studentId", "tripId", "boardingTripStopId", "dropOffTripStopId", status, "updatedAt")
VALUES ('upgrade-waitlist', 'upgrade-student', 'upgrade-trip', '00000000-0000-4000-8000-000000000021',
        '00000000-0000-4000-8000-000000000022', 'EXPIRED', now());
INSERT INTO "Penalty" (id, "bookingId", "studentId", status)
VALUES ('upgrade-penalty', 'upgrade-booking', 'upgrade-student', 'APPEALED');
UPDATE "User" SET "creditScore" = 85 WHERE id = 'upgrade-student';
INSERT INTO "PenaltyAppeal" (id, "penaltyId", "studentId", reason)
VALUES ('upgrade-appeal', 'upgrade-penalty', 'upgrade-student', 'Synthetic appeal');
INSERT INTO "Notification" (id, "userId", type, message, "deduplicationKey")
VALUES ('upgrade-notification', 'upgrade-student', 'PENALTY_ISSUED', 'Synthetic historical notice', 'upgrade-dedup');
