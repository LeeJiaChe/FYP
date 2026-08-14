import type { CreateWalkInIntentInput } from "../contracts/walk-in.schemas";
import {
  createWalkInIntentRecord,
  listOwnedWalkInRecords,
  loadOwnedActiveIntentRecord,
  WalkInPersistenceError,
} from "../infrastructure/walk-in.prisma.server";
import { issueBoardingPass } from "@/features/boarding/server";
import { conflict, forbidden, notFound, validationError } from "@/shared/application/application-error";
import { productPolicy, type ProductPolicy } from "@/shared/config/policies";
import { systemClock, type Clock } from "@/shared/time/clock";

export interface WalkInActor {
  readonly userId: string;
  readonly role: string;
}

function requireStudent(actor: WalkInActor): void {
  if (actor.role !== "STUDENT") throw forbidden("Student role required");
}

function translate(error: WalkInPersistenceError): never {
  switch (error.code) {
    case "STUDENT_NOT_FOUND":
      throw forbidden("Active student account required");
    case "TRIP_NOT_FOUND":
      throw notFound("Eligible Trip not found");
    case "INVALID_JOURNEY":
      throw validationError("Boarding and drop-off must form an ordered Trip journey");
    case "NOT_ELIGIBLE":
      throw conflict("Walk-in Pass issuance is not open for this boarding stop");
    case "RESERVED_BOOKING_EXISTS":
      throw conflict("A confirmed reserved Booking already exists for this Trip");
    case "INTENT_NOT_FOUND":
      throw notFound("Walk-in intent not found");
    case "INTENT_NOT_ACTIVE":
      throw conflict("Walk-in intent is no longer active for boarding");
  }
}

async function mapFailure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof WalkInPersistenceError) translate(error);
    throw error;
  }
}

export async function createWalkInIntent(
  actor: WalkInActor,
  input: CreateWalkInIntentInput,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  requireStudent(actor);
  const intent = await mapFailure(() =>
    createWalkInIntentRecord(actor.userId, input, clock.now(), policy),
  );
  return {
    id: intent.id,
    tripId: intent.tripId,
    boardingTripStopId: intent.boardingTripStopId,
    dropOffTripStopId: intent.dropOffTripStopId,
    status: intent.status,
    issuedAt: intent.issuedAt,
    expiresAt: intent.expiresAt,
    guaranteesBoarding: false as const,
  };
}

export async function issueWalkInPass(
  actor: WalkInActor,
  intentId: string,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  requireStudent(actor);
  const intent = await mapFailure(() =>
    loadOwnedActiveIntentRecord(actor.userId, intentId, clock.now()),
  );
  return issueBoardingPass(
    {
      purpose: "WALK_IN_BOARDING",
      journeyKind: "WALK_IN",
      recordId: intent.id,
      studentId: intent.studentId,
      tripId: intent.tripId,
    },
    clock,
    policy,
  );
}

export async function listMyWalkInIntents(actor: WalkInActor) {
  requireStudent(actor);
  const intents = await listOwnedWalkInRecords(actor.userId);
  return intents.map((intent) => ({
    id: intent.id,
    status: intent.status,
    issuedAt: intent.issuedAt,
    expiresAt: intent.expiresAt,
    boardingTripStopId: intent.boardingTripStopId,
    boardingStopName: intent.boardingTripStop.stopName,
    dropOffTripStopId: intent.dropOffTripStopId,
    dropOffStopName: intent.dropOffTripStop.stopName,
    trip: {
      id: intent.tripId,
      routeName: intent.trip.route.name,
      status: intent.trip.status,
      departureTime: intent.boardingTripStop.plannedDeparture,
    },
    journey: intent.journey
      ? {
          id: intent.journey.id,
          status: intent.journey.status,
          boardedAt: intent.journey.boardedAt,
          actualAlightedAt: intent.journey.actualAlightedAt,
          alightingMethod: intent.journey.alightingMethod,
        }
      : null,
    guaranteesBoarding: false as const,
  }));
}
