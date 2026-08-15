import type {
  CancelTripInput,
  ListTripsQuery,
  ScheduleTripInput,
  UpdateScheduledTripInput,
} from "../contracts/trip.schemas";
import { TripSnapshotError } from "../domain/build-trip-snapshot";
import {
  createScheduledTripRecord,
  cancelTripRecord,
  findTripDetailRecord,
  listTripRecords,
  TripPersistenceError,
  updateScheduledTripRecord,
} from "../infrastructure/trip.prisma.server";
import {
  conflict,
  forbidden,
  invariantViolation,
  notFound,
  validationError,
} from "@/shared/application/application-error";
import { productPolicy } from "@/shared/config/policies";
import { systemClock, type Clock } from "@/shared/time/clock";

export interface TripActor {
  readonly userId: string;
  readonly role: string;
}

function mapPersistenceFailure(error: TripPersistenceError): never {
  switch (error.code) {
    case "ROUTE_NOT_ACTIVE":
      throw notFound("Active Route not found");
    case "BUS_NOT_ACTIVE":
      throw notFound("Active Bus not found");
    case "DRIVER_NOT_VALID":
      throw validationError("Assigned driver must be an existing DRIVER");
    case "BUS_SCHEDULE_CONFLICT":
      throw conflict("Bus is already assigned to an overlapping Trip");
    case "DRIVER_SCHEDULE_CONFLICT":
      throw conflict("Driver is already assigned to an overlapping Trip");
    case "INVENTORY_COUNT_MISMATCH":
      throw invariantViolation("Trip inventory could not be created completely");
    case "TRIP_NOT_FOUND":
      throw notFound("Trip not found");
    case "TRIP_NOT_CANCELLABLE":
      throw conflict("Trip cannot be cancelled from its current state");
    case "TRIP_NOT_EDITABLE":
      throw conflict("Only empty, not-started Trips may be rescheduled or reassigned");
    case "ACTOR_FORBIDDEN":
      throw forbidden("Actor is not authorized for this Trip operation");
  }
}

export async function scheduleTrip(
  actor: TripActor,
  input: ScheduleTripInput,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");

  const departure = new Date(input.departureTime);
  if (departure.getTime() <= clock.now().getTime()) {
    throw validationError("Origin departure must be in the future");
  }

  try {
    return await createScheduledTripRecord(
      input,
      productPolicy.normalBoardingCloseGraceMs,
    );
  } catch (error) {
    if (error instanceof TripPersistenceError) mapPersistenceFailure(error);
    if (error instanceof TripSnapshotError) {
      throw invariantViolation(error.message);
    }
    throw error;
  }
}

export async function listTrips(actor: TripActor, query: ListTripsQuery) {
  const enforcedDriverId = actor.role === "DRIVER" ? actor.userId : undefined;
  const trips = await listTripRecords(query, enforcedDriverId);

  return trips.map((trip) => {
    const routeStops =
      trip.tripStops.length > 0
        ? trip.tripStops.map((stop) => stop.stopName)
        : trip.route.routeStops.map((routeStop) => routeStop.stop.name);
    const confirmedReserved = trip.bookings.filter(
      (booking) => booking.status === "CONFIRMED",
    ).length;
    const boardedReserved = trip.bookings.filter(
      (booking) => booking.status === "CONFIRMED" && booking.checkedInAt,
    ).length;
    const noShow = trip.bookings.filter((booking) => booking.status === "NO_SHOW").length;
    const walkInBoarded = trip.walkInJourneys.filter(
      (journey) => journey.status === "BOARDED",
    ).length;
    const waitlistWaiting = trip.waitlistEntries.filter(
      (entry) => entry.status === "WAITING",
    ).length;

    return {
      id: trip.id,
      routeId: trip.routeId,
      routeName: trip.route.name,
      routeStops,
      tripStops: trip.tripStops.map((stop) => ({
        id: stop.id,
        stopId: stop.stopId,
        position: stop.position,
        stopCode: stop.stopCode,
        stopName: stop.stopName,
        plannedArrival: stop.plannedArrival,
        plannedDeparture: stop.plannedDeparture,
        boardingDeadline: stop.boardingDeadline,
      })),
      busId: trip.busId,
      busPlateNumber: trip.bus.plateNumber,
      busCapacity: trip.seatedCapacity,
      seatedCapacity: trip.seatedCapacity,
      standingCapacity: trip.standingCapacity,
      driverId: trip.driverId,
      driverName: trip.driver?.name ?? "Unassigned",
      departureTime: trip.departureTime,
      estimatedArrivalTime: trip.estimatedArrivalTime,
      boardingDeadline: trip.boardingDeadline,
      status: trip.status,
      delayMinutes: trip.delayMinutes,
      delayReason: trip.delayReason,
      stats: {
        totalSeats: trip.seatedCapacity,
        confirmedReserved,
        boardedReserved,
        noShow,
        walkInBoarded,
        waitlistWaiting,
      },
    };
  });
}

export async function cancelTrip(
  actor: TripActor,
  tripId: string,
  input: CancelTripInput,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN" && actor.role !== "DRIVER") {
    throw forbidden("Admin or assigned Driver role required");
  }
  try {
    return await cancelTripRecord({
      tripId,
      actorId: actor.userId,
      reason: input.reason,
      now: clock.now(),
      allowAssignedDriver: actor.role === "DRIVER",
    });
  } catch (error) {
    if (error instanceof TripPersistenceError) mapPersistenceFailure(error);
    throw error;
  }
}

export async function updateScheduledTrip(
  actor: TripActor,
  tripId: string,
  input: UpdateScheduledTripInput,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  try {
    return await updateScheduledTripRecord(tripId, input, clock.now());
  } catch (error) {
    if (error instanceof TripPersistenceError) mapPersistenceFailure(error);
    throw error;
  }
}

export async function getTripDetail(actor: TripActor, tripId: string) {
  const trip = await findTripDetailRecord(tripId);
  if (!trip) throw notFound("Trip not found");
  if (actor.role === "DRIVER" && trip.driverId !== actor.userId) {
    throw forbidden("Driver may view only assigned Trips");
  }
  const canViewManifest = actor.role === "ADMIN" || actor.role === "DRIVER";
  const seats = trip.tripSeats.map((seat) => {
    const visibleBookings = seat.bookings.filter(
      (booking) => canViewManifest || booking.studentId === actor.userId,
    );
    const primary = visibleBookings[0];
    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      // Compatibility visualization only; journey availability never reads it.
      status: seat.bookings.some((booking) => booking.checkedInAt)
        ? "CHECKED_IN"
        : seat.bookings.length > 0
          ? "RESERVED"
          : "AVAILABLE",
      booking: primary
        ? {
            id: primary.id,
            status: primary.status,
            studentName: primary.student.name,
            studentId: primary.student.studentId,
            checkedInAt: primary.checkedInAt,
            checkInMethod: primary.checkInMethod,
          }
        : null,
      journeys: visibleBookings.map((booking) => ({
        bookingId: booking.id,
        boardingStopName: booking.boardingTripStop.stopName,
        dropOffStopName: booking.dropOffTripStop.stopName,
        status: booking.status,
      })),
      deviceHealth: "OK" as const,
    };
  });
  return {
    id: trip.id,
    routeId: trip.routeId,
    routeName: trip.route.name,
    routeStops: trip.tripStops.map((stop) => stop.stopName),
    tripStops: trip.tripStops.map((stop) => ({
      id: stop.id,
      stopId: stop.stopId,
      position: stop.position,
      code: stop.stopCode,
      name: stop.stopName,
      latitude: stop.latitude.toNumber(),
      longitude: stop.longitude.toNumber(),
      plannedArrival: stop.plannedArrival,
      plannedDeparture: stop.plannedDeparture,
      boardingDeadline: stop.boardingDeadline,
      actualArrival: stop.actualArrival,
      actualDeparture: stop.actualDeparture,
      passedAt: stop.passedAt,
    })),
    busId: trip.busId,
    busPlateNumber: trip.bus.plateNumber,
    seatedCapacity: trip.seatedCapacity,
    standingCapacity: trip.standingCapacity,
    driverId: trip.driverId,
    driverName: trip.driver?.name ?? "Unassigned",
    departureTime: trip.departureTime,
    estimatedArrivalTime: trip.estimatedArrivalTime,
    status: trip.status,
    delayMinutes: trip.delayMinutes,
    delayReason: trip.delayReason,
    seats,
    waitlist: canViewManifest
      ? trip.waitlistEntries
      : trip.waitlistEntries.filter((entry) => entry.studentId === actor.userId),
    stats: {
      totalSeats: trip.seatedCapacity,
      availableSeats: seats.filter((seat) => seat.status === "AVAILABLE").length,
      reservedSeats: seats.filter((seat) => seat.status === "RESERVED").length,
      checkedInSeats: seats.filter((seat) => seat.status === "CHECKED_IN").length,
      noShowSeats: 0,
    },
  };
}
