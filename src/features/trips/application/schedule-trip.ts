import type {
  CancelTripInput,
  CreateServiceBlockInput,
  ListTripsQuery,
  ScheduleTripInput,
  UpdateScheduledTripInput,
} from "../contracts/trip.schemas";
import { TripSnapshotError } from "../domain/build-trip-snapshot";
import {
  createScheduledTripRecord,
  createServiceBlockRecord,
  cancelTripRecord,
  findTripDetailRecord,
  listTripRecords,
  listDriverOperationRecords,
  listServiceBlockRecords,
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
import { currentOperationalSegmentPosition } from "../domain/operational-segment";
import { resolveDriverOperation } from "../domain/driver-operation";
import { evaluateServiceBlockContinuity } from "../domain/service-block-continuity";

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
    case "SERVICE_BLOCK_NOT_FOUND":
      throw notFound("ServiceBlock not found");
    case "SERVICE_BLOCK_BUS_MISMATCH":
      throw conflict("Trip Bus must match the selected ServiceBlock Bus");
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
  const blockTrips = new Map<string, typeof trips>();
  for (const trip of trips) {
    if (!trip.blockId) continue;
    const values = blockTrips.get(trip.blockId) ?? [];
    values.push(trip);
    blockTrips.set(trip.blockId, values);
  }
  for (const values of blockTrips.values()) {
    values.sort(
      (left, right) =>
        (left.blockSequence ?? 0) - (right.blockSequence ?? 0),
    );
  }

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
    const tripsInBlock = trip.blockId ? blockTrips.get(trip.blockId) : undefined;
    const blockIndex = tripsInBlock?.findIndex((item) => item.id === trip.id) ?? -1;

    return {
      id: trip.id,
      routeId: trip.routeId,
      routeName: trip.route.name,
      lineId: trip.route.lineId,
      lineCode: trip.route.line.code,
      lineName: trip.route.line.name,
      direction: trip.route.direction,
      routeStops,
      tripStops: trip.tripStops.map((stop) => ({
        id: stop.id,
        stopId: stop.stopId,
        position: stop.position,
        stopCode: stop.stopCode,
        stopName: stop.stopName,
        latitude: stop.latitude.toNumber(),
        longitude: stop.longitude.toNumber(),
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
      blockId: trip.blockId,
      blockCode: trip.block?.code ?? null,
      blockSequence: trip.blockSequence,
      continuityFromPrevious:
        tripsInBlock && blockIndex > 0
          ? evaluateServiceBlockContinuity(
              tripsInBlock[blockIndex - 1]!,
              trip,
            )
          : null,
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

export async function createServiceBlock(
  actor: TripActor,
  input: CreateServiceBlockInput,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  try {
    const block = await createServiceBlockRecord(input);
    return {
      id: block.id,
      code: block.code,
      serviceDate: block.serviceDate,
      busId: block.busId,
      busPlateNumber: block.bus.plateNumber,
      trips: [],
    };
  } catch (error) {
    if (error instanceof TripPersistenceError) mapPersistenceFailure(error);
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") || error.message.includes("P2002"))
    ) {
      throw conflict("A ServiceBlock with this code already exists for that date");
    }
    throw error;
  }
}

export async function listServiceBlocks(actor: TripActor) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  return (await listServiceBlockRecords()).map((block) => ({
    id: block.id,
    code: block.code,
    serviceDate: block.serviceDate,
    busId: block.busId,
    busPlateNumber: block.bus.plateNumber,
    trips: block.trips.map((trip, index) => ({
      id: trip.id,
      blockSequence: trip.blockSequence,
      departureTime: trip.departureTime,
      routeName: trip.route.name,
      lineCode: trip.route.line.code,
      direction: trip.route.direction,
      driverName: trip.driver?.name ?? "Unassigned",
      continuityFromPrevious:
        index === 0
          ? null
          : evaluateServiceBlockContinuity(block.trips[index - 1]!, trip),
    })),
  }));
}

function driverOperationTripDto(
  trip: Awaited<ReturnType<typeof listDriverOperationRecords>>[number],
) {
  return {
    id: trip.id,
    routeId: trip.routeId,
    routeName: trip.route.name,
    lineCode: trip.route.line.code,
    lineName: trip.route.line.name,
    direction: trip.route.direction,
    busId: trip.busId,
    busPlateNumber: trip.bus.plateNumber,
    driverId: trip.driverId,
    departureTime: trip.departureTime,
    estimatedArrivalTime: trip.estimatedArrivalTime,
    status: trip.status,
    blockCode: trip.block?.code ?? null,
    blockSequence: trip.blockSequence,
  };
}

export async function getDriverOperation(
  actor: TripActor,
  clock: Clock = systemClock,
) {
  if (actor.role !== "DRIVER") throw forbidden("Driver role required");
  const now = clock.now();
  const trips = await listDriverOperationRecords(actor.userId);
  const resolved = resolveDriverOperation({
    driverId: actor.userId,
    trips,
    now,
    boardingOpenLeadMs: productPolicy.boardingOpenLeadMs,
  });
  return {
    state: resolved.state,
    reason: resolved.reason,
    serverNow: now,
    activationAt: resolved.activationAt,
    currentTrip: resolved.currentTrip
      ? driverOperationTripDto(resolved.currentTrip)
      : null,
    nextTrip: resolved.nextTrip ? driverOperationTripDto(resolved.nextTrip) : null,
    conflictTripIds: resolved.conflictTripIds,
  };
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
  const currentSegmentPosition = currentOperationalSegmentPosition(
    trip.status,
    trip.tripStops,
  );
  const currentSegment =
    currentSegmentPosition === null
      ? null
      : trip.tripSegments.find(
          (segment) => segment.position === currentSegmentPosition,
        ) ?? null;
  const allClaims = trip.tripSegments.flatMap(
    (segment) => segment.reservedSeatSegments,
  );
  const seats = trip.tripSeats.map((seat) => {
    const visibleClaims = allClaims.filter(
      (claim) =>
        claim.tripSeatId === seat.id &&
        (canViewManifest || claim.booking.studentId === actor.userId),
    );
    const currentClaim = currentSegment?.reservedSeatSegments.find(
      (claim) => claim.tripSeatId === seat.id,
    );
    const primary = currentClaim?.booking ?? visibleClaims[0]?.booking;
    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      // This projection describes only the current/upcoming operational segment.
      status: currentClaim?.booking.checkedInAt
        ? "CHECKED_IN"
        : currentClaim
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
      journeys: visibleClaims.map(({ booking }) => ({
        bookingId: booking.id,
        boardingStopName: booking.boardingTripStop.stopName,
        dropOffStopName: booking.dropOffTripStop.stopName,
        status: booking.status,
      })),
    };
  });
  return {
    id: trip.id,
    routeId: trip.routeId,
    routeName: trip.route.name,
    lineId: trip.route.line.id,
    lineCode: trip.route.line.code,
    lineName: trip.route.line.name,
    direction: trip.route.direction,
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
    blockId: trip.blockId,
    blockCode: trip.block?.code ?? null,
    blockSequence: trip.blockSequence,
    departureTime: trip.departureTime,
    estimatedArrivalTime: trip.estimatedArrivalTime,
    status: trip.status,
    delayMinutes: trip.delayMinutes,
    delayReason: trip.delayReason,
    currentSegment: currentSegment
      ? {
          id: currentSegment.id,
          position: currentSegment.position,
          fromStopName: trip.tripStops[currentSegment.position]?.stopName,
          toStopName: trip.tripStops[currentSegment.position + 1]?.stopName,
        }
      : null,
    latestLocation: trip.locationSamples[0]
      ? {
          latitude: trip.locationSamples[0].latitude.toNumber(),
          longitude: trip.locationSamples[0].longitude.toNumber(),
          recordedAt: trip.locationSamples[0].recordedAt,
          source: trip.locationSamples[0].source,
        }
      : null,
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
      standingPassengers: currentSegment?.standingClaims.length ?? 0,
      standingCapacity: trip.standingCapacity,
    },
  };
}
