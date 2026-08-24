import "server-only";

import type { Prisma } from "@prisma/client";

import type { CreateWalkInIntentInput } from "../contracts/walk-in.schemas";
import { isWalkInIssuanceEligible } from "@/features/boarding/public";
import { deriveJourneySegments } from "@/shared/domain/journey-segments";
import type { ProductPolicy } from "@/shared/config/policies";
import { prisma } from "@/shared/db/prisma.server";

export type WalkInPersistenceFailure =
  | "STUDENT_NOT_FOUND"
  | "TRIP_NOT_FOUND"
  | "INVALID_JOURNEY"
  | "NOT_ELIGIBLE"
  | "RESERVED_BOOKING_EXISTS"
  | "INTENT_NOT_FOUND"
  | "INTENT_NOT_ACTIVE";

export class WalkInPersistenceError extends Error {
  constructor(readonly code: WalkInPersistenceFailure) {
    super(code);
    this.name = "WalkInPersistenceError";
  }
}

async function expireStaleIntent(
  transaction: Prisma.TransactionClient,
  intentId: string,
): Promise<void> {
  await transaction.walkInIntent.updateMany({
    where: { id: intentId, status: "PENDING" },
    data: { status: "EXPIRED" },
  });
}

export async function createWalkInIntentRecord(
  studentId: string,
  input: CreateWalkInIntentInput,
  now: Date,
  policy: ProductPolicy,
) {
  return prisma.$transaction(async (transaction) => {
    const student = await transaction.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      select: { id: true },
    });
    if (!student) throw new WalkInPersistenceError("STUDENT_NOT_FOUND");

    const trip = await transaction.trip.findUnique({
      where: { id: input.tripId },
      include: {
        tripStops: { orderBy: { position: "asc" } },
        tripSegments: { orderBy: { position: "asc" } },
      },
    });
    if (!trip || trip.status === "ARRIVED" || trip.status === "CANCELLED") {
      throw new WalkInPersistenceError("TRIP_NOT_FOUND");
    }
    const boarding = trip.tripStops.find(
      (stop) => stop.id === input.boardingTripStopId,
    );
    const dropOff = trip.tripStops.find(
      (stop) => stop.id === input.dropOffTripStopId,
    );
    if (!boarding || !dropOff) {
      throw new WalkInPersistenceError("INVALID_JOURNEY");
    }
    try {
      deriveJourneySegments(boarding, dropOff, trip.tripSegments);
    } catch {
      throw new WalkInPersistenceError("INVALID_JOURNEY");
    }
    if (
      !isWalkInIssuanceEligible(
        now,
        trip.status,
        boarding,
        policy,
      )
    ) {
      throw new WalkInPersistenceError("NOT_ELIGIBLE");
    }

    const confirmed = await transaction.booking.findFirst({
      where: { studentId, tripId: trip.id, status: "CONFIRMED" },
      select: { id: true },
    });
    if (confirmed) {
      throw new WalkInPersistenceError("RESERVED_BOOKING_EXISTS");
    }

    const existing = await transaction.walkInIntent.findFirst({
      where: {
        studentId,
        tripId: trip.id,
        boardingTripStopId: boarding.id,
        dropOffTripStopId: dropOff.id,
        status: "PENDING",
      },
    });
    if (existing && existing.expiresAt > now) return existing;
    if (existing) await expireStaleIntent(transaction, existing.id);

    return transaction.walkInIntent.create({
      data: {
        studentId,
        tripId: trip.id,
        boardingTripStopId: boarding.id,
        dropOffTripStopId: dropOff.id,
        status: "PENDING",
        issuedAt: now,
        // Stop progress closes admission earlier. This bounded record expiry
        // tolerates operational delay without pretending the pass guarantees it.
        expiresAt: new Date(
          boarding.plannedDeparture.getTime() + policy.bookingOpenLeadMs,
        ),
      },
    });
  });
}

export async function loadOwnedActiveIntentRecord(
  studentId: string,
  intentId: string,
  now: Date,
) {
  const intent = await prisma.walkInIntent.findUnique({
    where: { id: intentId },
    include: {
      boardingTripStop: true,
      dropOffTripStop: true,
      trip: { include: { route: { select: { name: true } } } },
    },
  });
  if (!intent || intent.studentId !== studentId) {
    throw new WalkInPersistenceError("INTENT_NOT_FOUND");
  }
  if (
    intent.status !== "PENDING" ||
    intent.expiresAt <= now ||
    intent.trip.status === "ARRIVED" ||
    intent.trip.status === "CANCELLED" ||
    intent.boardingTripStop.actualDeparture ||
    intent.boardingTripStop.passedAt
  ) {
    throw new WalkInPersistenceError("INTENT_NOT_ACTIVE");
  }
  return intent;
}

export async function listOwnedWalkInRecords(studentId: string) {
  return prisma.walkInIntent.findMany({
    where: { studentId },
    include: {
      boardingTripStop: true,
      dropOffTripStop: true,
      trip: { include: { route: { select: { name: true } } } },
      journey: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
