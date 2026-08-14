import type {
  ListTripsQuery,
  ScheduleTripInput,
} from "../contracts/trip.schemas";
import { TripSnapshotError } from "../domain/build-trip-snapshot";
import {
  createScheduledTripRecord,
  listTripRecords,
  TripPersistenceError,
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
    const availableSeats = trip.seats.filter(
      (seat) => seat.status === "AVAILABLE",
    ).length;
    const reservedSeats = trip.seats.filter(
      (seat) => seat.status === "RESERVED",
    ).length;
    const checkedInSeats = trip.seats.filter(
      (seat) => seat.status === "CHECKED_IN",
    ).length;
    const noShowSeats = trip.seats.filter(
      (seat) => seat.status === "NO_SHOW",
    ).length;

    return {
      id: trip.id,
      routeId: trip.routeId,
      routeName: trip.route.name,
      routeStops,
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
      delayReason: trip.delayReason,
      stats: {
        totalSeats: trip.seatedCapacity,
        availableSeats,
        reservedSeats,
        checkedInSeats,
        noShowSeats,
      },
    };
  });
}
