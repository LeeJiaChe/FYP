import type {
  CancelTripInput,
  CreateServiceBlockInput,
  BulkScheduleInput,
  ListTripsQuery,
  ScheduleTripInput,
  UpdateScheduledTripInput,
} from "../contracts/trip.schemas";
import { TripSnapshotError } from "../domain/build-trip-snapshot";
import {
  createScheduledTripRecord,
  createBulkScheduledTripRecords,
  createServiceBlockRecord,
  cancelTripRecord,
  findTripDetailRecord,
  listTripRecords,
  listDriverOperationRecords,
  listServiceBlockRecords,
  loadBulkScheduleContext,
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
import {
  detectBulkResourceConflicts,
  generateBulkTripCandidates,
  validateBulkServiceBlock,
} from "../domain/bulk-schedule";
import { projectTripSeatForActor } from "../domain/trip-seat-projection";
import { resolveStudentTrackingState } from "../domain/student-tracking-eligibility";
import { resolveStudentBookingEligibility } from "@/features/bookings/server";
import { isWalkInIssuanceEligible } from "@/features/boarding/public";

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
    case "SERVICE_BLOCK_DATE_MISMATCH":
      throw conflict("Trip departure date must match the selected ServiceBlock service date.");
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

export async function previewBulkSchedule(
  actor: TripActor,
  input: BulkScheduleInput,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  let candidates;
  try {
    candidates = generateBulkTripCandidates(input);
  } catch (error) {
    throw validationError(error instanceof Error ? error.message : "Invalid bulk timetable");
  }
  if (candidates.length === 0) throw validationError("No departures match the selected dates and weekdays");
  const context = await loadBulkScheduleContext({
    routeId: input.routeId,
    busIds: input.busIds,
    driverIds: input.driverIds,
    blockId: input.blockId,
    from: candidates[0]!.departureTime,
    to: new Date(candidates.at(-1)!.departureTime.getTime() + 24 * 60 * 60_000),
  });
  if (!context.route) throw notFound("Active Route not found");
  const routeDurationMinutes = context.route.routeStops.reduce(
    (sum, stop) => sum + (stop.travelDurationToNextMinutes ?? 0),
    0,
  );
  if (routeDurationMinutes <= 0) throw invariantViolation("Route travel duration is invalid");
  const busById = new Map(context.buses.map((bus) => [bus.id, bus]));
  const driverById = new Map(context.drivers.map((driver) => [driver.id, driver]));
  const proposed: Array<{
    key: string;
    routeId: string;
    busId: string;
    driverId?: string;
    blockId?: string;
    departureTime: Date;
    estimatedArrivalTime: Date;
    tripStops: Array<{ stopId: string; stopName: string; position: number }>;
    errors: string[];
    warnings: ReturnType<typeof evaluateServiceBlockContinuity>[];
  }> = [];

  for (const candidate of candidates) {
    const estimatedArrivalTime = new Date(
      candidate.departureTime.getTime() + routeDurationMinutes * 60_000,
    );
    const errors: string[] = [];
    if (candidate.departureTime <= clock.now()) errors.push("DEPARTURE_NOT_FUTURE");
    if (!busById.has(candidate.busId)) errors.push("BUS_NOT_ACTIVE");
    if (candidate.driverId && !driverById.has(candidate.driverId)) errors.push("DRIVER_NOT_VALID");
    errors.push(
      ...validateBulkServiceBlock(candidate, context.block, Boolean(input.blockId)),
      ...detectBulkResourceConflicts(
        { ...candidate, estimatedArrivalTime },
        [...context.existingTrips, ...proposed],
      ),
    );
    proposed.push({
      ...candidate,
      estimatedArrivalTime,
      tripStops: context.route.routeStops.map((stop) => ({
        stopId: stop.stopId,
        stopName: stop.stop.name,
        position: stop.position,
      })),
      errors: [...new Set(errors)],
      warnings: [],
    });
  }

  if (context.block) {
    const sequence = [...context.block.trips, ...proposed].sort(
      (left, right) => left.departureTime.getTime() - right.departureTime.getTime(),
    );
    for (let index = 1; index < sequence.length; index += 1) {
      const current = sequence[index]!;
      if (!("key" in current)) continue;
      current.warnings.push(
        evaluateServiceBlockContinuity(sequence[index - 1]!, current, productPolicy),
      );
    }
  }

  return {
    route: {
      id: context.route.id,
      name: context.route.name,
      lineCode: context.route.line.code,
      direction: context.route.direction,
    },
    entries: proposed.map((item) => ({
      key: item.key,
      departureTime: item.departureTime,
      estimatedArrivalTime: item.estimatedArrivalTime,
      busId: item.busId,
      busPlateNumber: busById.get(item.busId)?.plateNumber ?? "Unavailable",
      driverId: item.driverId ?? null,
      driverName: item.driverId ? driverById.get(item.driverId)?.name ?? "Unavailable" : "Unassigned",
      errors: item.errors,
      warnings: item.warnings,
    })),
    canConfirm: proposed.every((item) => item.errors.length === 0),
  };
}

export async function confirmBulkSchedule(
  actor: TripActor,
  input: BulkScheduleInput,
  clock: Clock = systemClock,
) {
  const preview = await previewBulkSchedule(actor, input, clock);
  if (!preview.canConfirm) throw conflict("Bulk timetable preview contains scheduling failures");
  const candidates = generateBulkTripCandidates(input);
  try {
    const trips = await createBulkScheduledTripRecords(
      candidates.map((candidate) => ({
        routeId: candidate.routeId,
        busId: candidate.busId,
        ...(candidate.driverId ? { driverId: candidate.driverId } : {}),
        ...(candidate.blockId ? { blockId: candidate.blockId } : {}),
        departureTime: candidate.departureTime.toISOString(),
      })),
      productPolicy.normalBoardingCloseGraceMs,
    );
    return { createdCount: trips.length, tripIds: trips.map((trip) => trip.id) };
  } catch (error) {
    if (error instanceof TripPersistenceError) mapPersistenceFailure(error);
    throw error;
  }
}

export async function listTrips(
  actor: TripActor,
  query: ListTripsQuery,
  clock: Clock = systemClock,
) {
  if (!["ADMIN", "DRIVER", "STUDENT"].includes(actor.role)) {
    throw forbidden("Recognized portal role required");
  }
  const enforcedDriverId = actor.role === "DRIVER" ? actor.userId : undefined;
  const trips = await listTripRecords(
    query,
    enforcedDriverId,
    actor.role === "STUDENT" ? actor.userId : undefined,
  );
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

  const now = clock.now();
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

    const shared = {
      id: trip.id,
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
        actualArrival: stop.actualArrival,
        actualDeparture: stop.actualDeparture,
        passedAt: stop.passedAt,
      })),
      busPlateNumber: trip.bus.plateNumber,
      departureTime: trip.departureTime,
      estimatedArrivalTime: trip.estimatedArrivalTime,
      status: trip.status,
      expectedDelayMinutes: trip.delayMinutes,
      expectedDelayReason: trip.delayReason,
    };

    if (actor.role === "STUDENT") {
      return {
        ...shared,
        trackingState: resolveStudentTrackingState(
          trip.status,
          trip.departureTime,
          now,
        ),
        tripStops: shared.tripStops.map((stop) => ({
          ...stop,
          bookingEligibility: resolveStudentBookingEligibility(
            {
              tripStatus: trip.status,
              boardingPlannedDeparture: stop.plannedDeparture,
              boardingActualArrival: stop.actualArrival,
              boardingActualDeparture: stop.actualDeparture,
              boardingPassedAt: stop.passedAt,
              studentCredit: trip.viewerCreditScore ?? productPolicy.initialCredit,
              now,
            },
            productPolicy,
            {
              canCreateWalkInIntent: isWalkInIssuanceEligible(
                now,
                trip.status,
                stop,
                productPolicy,
              ),
            },
          ),
        })),
      };
    }

    return {
      ...shared,
      routeId: trip.routeId,
      busId: trip.busId,
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
              productPolicy,
            )
          : null,
      boardingDeadline: trip.boardingDeadline,
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
          : evaluateServiceBlockContinuity(
              block.trips[index - 1]!,
              trip,
              productPolicy,
            ),
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
  if (actor.role !== "ADMIN") {
    throw forbidden("Admin role required");
  }
  try {
    return await cancelTripRecord({
      tripId,
      actorId: actor.userId,
      reason: input.reason,
      now: clock.now(),
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
  if (!["ADMIN", "DRIVER", "STUDENT"].includes(actor.role)) {
    throw forbidden("Recognized portal role required");
  }
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
    const seatClaims = allClaims.filter((claim) => claim.tripSeatId === seat.id);
    const currentClaim = currentSegment?.reservedSeatSegments.find(
      (claim) => claim.tripSeatId === seat.id,
    );
    return projectTripSeatForActor({ actor, seat, currentClaim, seatClaims });
  });
  const shared = {
    id: trip.id,
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
    busPlateNumber: trip.bus.plateNumber,
    seatedCapacity: trip.seatedCapacity,
    standingCapacity: trip.standingCapacity,
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
  };

  if (actor.role === "STUDENT") {
    return shared;
  }

  return {
    ...shared,
    routeId: trip.routeId,
    busId: trip.busId,
    driverId: trip.driverId,
    driverName: trip.driver?.name ?? "Unassigned",
    blockId: trip.blockId,
    blockCode: trip.block?.code ?? null,
    blockSequence: trip.blockSequence,
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
