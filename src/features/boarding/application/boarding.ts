import type {
  AlightingInput,
  AlightingPassInput,
  ManualBoardingInput,
  TripProgressInput,
} from "../contracts/boarding.schemas";
import {
  admitWalkInRecord,
  boardReservedRecord,
  BoardingPersistenceError,
  confirmAlightingRecord,
  getDriverManifestRecord,
  loadStudentPassRecord,
  progressTripRecord,
  type BoardingActorRecord,
} from "../infrastructure/boarding.prisma.server";
import {
  issueSignedPass,
  PassTokenError,
  verifySignedPass,
} from "../infrastructure/pass-token.server";
import { conflict, forbidden, notFound, validationError } from "@/shared/application/application-error";
import { productPolicy, type ProductPolicy } from "@/shared/config/policies";
import { systemClock, type Clock } from "@/shared/time/clock";

export type BoardingActor = BoardingActorRecord;

function translatePersistence(error: BoardingPersistenceError): never {
  switch (error.code) {
    case "ACTOR_FORBIDDEN":
      throw forbidden("Driver or explicit administrator authority required");
    case "UNASSIGNED_TRIP":
      throw forbidden("Driver may operate only the Trip assigned to them");
    case "TRIP_NOT_FOUND":
      throw notFound("Trip not found");
    case "BOOKING_NOT_FOUND":
      throw notFound("Reserved Booking not found");
    case "INTENT_NOT_FOUND":
      throw notFound("Walk-in intent not found");
    case "JOURNEY_NOT_FOUND":
      throw notFound("Passenger journey not found");
    case "WRONG_TRIP":
      throw conflict("Pass or passenger journey belongs to a different Trip");
    case "TOKEN_RECORD_MISMATCH":
      throw conflict("Signed pass does not match the durable passenger record");
    case "INVALID_STATE":
      throw conflict("Passenger record is not eligible for this operation");
    case "INVALID_JOURNEY":
      throw conflict("Durable journey topology or allocation is incomplete");
    case "BOARDING_CLOSED":
      throw conflict("Passenger boarding stop is not currently boardable");
    case "ALIGHTING_NOT_ALLOWED":
      throw conflict("Passenger is not at the planned drop-off stop");
    case "ILLEGAL_TRIP_TRANSITION":
      throw conflict("Trip progress transition is not legal from its current state");
  }
}

async function mapFailure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof BoardingPersistenceError) translatePersistence(error);
    throw error;
  }
}

function verifyToken(token: string, clock: Clock) {
  try {
    return verifySignedPass(token, clock);
  } catch (error) {
    if (error instanceof PassTokenError) {
      if (error.code === "EXPIRED") throw conflict(error.message);
      throw validationError(error.message);
    }
    throw error;
  }
}

export async function boardWithPass(
  actor: BoardingActor,
  tripId: string,
  token: string,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  const claims = verifyToken(token, clock);
  if (claims.tripId !== tripId) {
    throw conflict("Pass belongs to a different Trip");
  }
  if (claims.purpose === "RESERVED_BOARDING" && claims.journeyKind === "RESERVED") {
    return mapFailure(() =>
      boardReservedRecord(
        actor,
        tripId,
        claims.recordId,
        "QR",
        clock.now(),
        policy,
        claims,
      ),
    );
  }
  if (claims.purpose === "WALK_IN_BOARDING" && claims.journeyKind === "WALK_IN") {
    return mapFailure(() =>
      admitWalkInRecord(
        actor,
        tripId,
        claims.recordId,
        "QR",
        clock.now(),
        policy,
        claims,
      ),
    );
  }
  throw validationError("Pass purpose is not valid for boarding");
}

export async function boardManually(
  actor: BoardingActor,
  tripId: string,
  input: ManualBoardingInput,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  if (input.kind === "RESERVED") {
    return mapFailure(() =>
      boardReservedRecord(
        actor,
        tripId,
        input.bookingId,
        "MANUAL",
        clock.now(),
        policy,
      ),
    );
  }
  return mapFailure(() =>
    admitWalkInRecord(
      actor,
      tripId,
      input.walkInIntentId,
      "MANUAL",
      clock.now(),
      policy,
    ),
  );
}

export async function confirmAlighting(
  actor: BoardingActor,
  tripId: string,
  input: AlightingInput,
  clock: Clock = systemClock,
) {
  if (input.mode === "MANUAL") {
    return mapFailure(() =>
      confirmAlightingRecord(
        actor,
        tripId,
        input.kind,
        input.recordId,
        "MANUAL",
        clock.now(),
      ),
    );
  }
  const claims = verifyToken(input.token, clock);
  if (claims.purpose !== "ALIGHTING" || claims.tripId !== tripId) {
    throw validationError("Expected an Alighting Pass for this Trip");
  }
  return mapFailure(() =>
    confirmAlightingRecord(
      actor,
      tripId,
      claims.journeyKind,
      claims.recordId,
      "QR",
      clock.now(),
      claims,
    ),
  );
}

export async function issueReservedBoardingPass(
  actor: BoardingActor,
  bookingId: string,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  if (actor.role !== "STUDENT") throw forbidden("Student role required");
  const record = await mapFailure(() =>
    loadStudentPassRecord(
      actor.userId,
      "RESERVED",
      bookingId,
      "RESERVED_BOARDING",
      clock.now(),
      policy,
    ),
  );
  return issueSignedPass(
    {
      purpose: "RESERVED_BOARDING",
      journeyKind: "RESERVED",
      recordId: record.recordId,
      studentId: record.studentId,
      tripId: record.tripId,
    },
    clock,
    policy,
  );
}

export async function issueAlightingPass(
  actor: BoardingActor,
  input: AlightingPassInput,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  if (actor.role !== "STUDENT") throw forbidden("Student role required");
  const record = await mapFailure(() =>
    loadStudentPassRecord(actor.userId, input.kind, input.recordId, "ALIGHTING"),
  );
  return issueSignedPass(
    {
      purpose: "ALIGHTING",
      journeyKind: input.kind,
      recordId: record.recordId,
      studentId: record.studentId,
      tripId: record.tripId,
    },
    clock,
    policy,
  );
}

export async function progressTrip(
  actor: BoardingActor,
  tripId: string,
  input: TripProgressInput,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  return mapFailure(() =>
    progressTripRecord(actor, tripId, input, clock.now(), policy),
  );
}

export async function getDriverManifest(actor: BoardingActor, tripId: string) {
  const { trip, currentStop } = await mapFailure(() =>
    getDriverManifestRecord(actor, tripId),
  );
  const manifest = [
    ...trip.bookings.map((booking) => ({
      recordId: booking.id,
      kind: "RESERVED" as const,
      passengerName: booking.student.name,
      studentId: booking.student.studentId,
      seatNumber: booking.tripSeat.seatNumber,
      boardingStop: booking.boardingTripStop.stopName,
      dropOffStop: booking.dropOffTripStop.stopName,
      boarded: booking.checkedInAt !== null,
      alighted: booking.actualAlightedAt !== null,
      expectedToAlightHere: booking.dropOffTripStop.id === currentStop?.id,
    })),
    ...trip.walkInJourneys.map((journey) => ({
      recordId: journey.id,
      kind: "WALK_IN" as const,
      passengerName: journey.student.name,
      studentId: journey.student.studentId,
      seatNumber: null,
      boardingStop: journey.boardingTripStop.stopName,
      dropOffStop: journey.dropOffTripStop.stopName,
      boarded: true,
      alighted: journey.actualAlightedAt !== null,
      expectedToAlightHere: journey.dropOffTripStop.id === currentStop?.id,
    })),
  ];
  return {
    trip: {
      id: trip.id,
      routeName: trip.route.name,
      busPlateNumber: trip.bus.plateNumber,
      status: trip.status,
      delayMinutes: trip.delayMinutes,
      delayReason: trip.delayReason,
      standingCapacity: trip.standingCapacity,
    },
    currentStop: currentStop
      ? {
          id: currentStop.id,
          position: currentStop.position,
          name: currentStop.stopName,
          plannedDeparture: currentStop.plannedDeparture,
          actualArrival: currentStop.actualArrival,
        }
      : null,
    stops: trip.tripStops.map((stop) => ({
      id: stop.id,
      position: stop.position,
      name: stop.stopName,
      plannedDeparture: stop.plannedDeparture,
      actualArrival: stop.actualArrival,
      actualDeparture: stop.actualDeparture,
      passedAt: stop.passedAt,
    })),
    manifest,
  };
}
