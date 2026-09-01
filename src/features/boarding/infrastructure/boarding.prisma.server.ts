import "server-only";

import { Prisma, type CheckInMethod } from "@prisma/client";

import { evaluateBoardingEligibility } from "../domain/boarding-policy";
import { assertTripTransition } from "@/features/trips/public";
import { processNoShowsAtTripStopInTransaction } from "@/features/penalties/server";
import type { ProductPolicy } from "@/shared/config/policies";
import { prisma } from "@/shared/db/prisma.server";
import { deriveJourneySegments } from "@/shared/domain/journey-segments";

type Transaction = Prisma.TransactionClient;

export type BoardingFailure =
  | "ACTOR_FORBIDDEN"
  | "TRIP_NOT_FOUND"
  | "UNASSIGNED_TRIP"
  | "BOOKING_NOT_FOUND"
  | "INTENT_NOT_FOUND"
  | "JOURNEY_NOT_FOUND"
  | "WRONG_TRIP"
  | "TOKEN_RECORD_MISMATCH"
  | "INVALID_STATE"
  | "INVALID_JOURNEY"
  | "BOARDING_CLOSED"
  | "ALIGHTING_NOT_ALLOWED"
  | "ILLEGAL_TRIP_TRANSITION";

export class BoardingPersistenceError extends Error {
  constructor(readonly code: BoardingFailure) {
    super(code);
    this.name = "BoardingPersistenceError";
  }
}

export interface BoardingActorRecord {
  readonly userId: string;
  readonly role: string;
}

export interface ExpectedPassRecord {
  readonly studentId: string;
  readonly tripId: string;
}

async function lockTrip(transaction: Transaction, tripId: string): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE
  `;
  if (rows.length !== 1) throw new BoardingPersistenceError("TRIP_NOT_FOUND");
}

async function authorizeOperator(
  transaction: Transaction,
  actor: BoardingActorRecord,
  tripId: string,
) {
  const [liveActor, trip] = await Promise.all([
    transaction.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, role: true },
    }),
    transaction.trip.findUnique({
      where: { id: tripId },
      select: { id: true, driverId: true, status: true, standingCapacity: true },
    }),
  ]);
  if (!liveActor || (liveActor.role !== "DRIVER" && liveActor.role !== "ADMIN")) {
    throw new BoardingPersistenceError("ACTOR_FORBIDDEN");
  }
  if (!trip) throw new BoardingPersistenceError("TRIP_NOT_FOUND");
  if (liveActor.role === "DRIVER" && trip.driverId !== liveActor.id) {
    throw new BoardingPersistenceError("UNASSIGNED_TRIP");
  }
  return { actor: liveActor, trip };
}

function assertExpectedPass(
  expected: ExpectedPassRecord | undefined,
  actual: { studentId: string; tripId: string },
): void {
  if (
    expected &&
    (expected.studentId !== actual.studentId || expected.tripId !== actual.tripId)
  ) {
    throw new BoardingPersistenceError("TOKEN_RECORD_MISMATCH");
  }
}

function assertBoardable(
  now: Date,
  tripStatus: "NOT_STARTED" | "BOARDING" | "DEPARTED" | "ARRIVED" | "CANCELLED",
  stop: {
    plannedDeparture: Date;
    actualArrival: Date | null;
    actualDeparture: Date | null;
    passedAt: Date | null;
  },
  policy: ProductPolicy,
): void {
  const eligibility = evaluateBoardingEligibility(now, tripStatus, stop, policy);
  if (!eligibility.allowed) {
    throw new BoardingPersistenceError("BOARDING_CLOSED");
  }
}

export async function boardReservedRecord(
  actor: BoardingActorRecord,
  tripId: string,
  bookingId: string,
  method: CheckInMethod,
  now: Date,
  policy: ProductPolicy,
  expectedPass?: ExpectedPassRecord,
) {
  return prisma.$transaction(async (transaction) => {
    await lockTrip(transaction, tripId);
    const { trip } = await authorizeOperator(transaction, actor, tripId);
    const booking = await transaction.booking.findUnique({
      where: { id: bookingId },
      include: {
        boardingTripStop: true,
        dropOffTripStop: true,
        reservedSeatSegments: true,
        student: { select: { id: true, name: true, studentId: true } },
        tripSeat: { select: { seatNumber: true } },
      },
    });
    if (!booking) throw new BoardingPersistenceError("BOOKING_NOT_FOUND");
    if (booking.tripId !== tripId) throw new BoardingPersistenceError("WRONG_TRIP");
    assertExpectedPass(expectedPass, booking);
    if (booking.checkedInAt) {
      return {
        outcome: "ALREADY_BOARDED" as const,
        tripId,
        bookingId: booking.id,
        passengerName: booking.student.name,
        studentId: booking.student.studentId,
        seatNumber: booking.tripSeat.seatNumber,
      };
    }
    if (booking.status !== "CONFIRMED") {
      throw new BoardingPersistenceError("INVALID_STATE");
    }
    assertBoardable(now, trip.status, booking.boardingTripStop, policy);
    const segments = await transaction.tripSegment.findMany({
      where: { tripId },
      orderBy: { position: "asc" },
      select: { id: true, tripId: true, position: true },
    });
    const traversed = deriveJourneySegments(
      booking.boardingTripStop,
      booking.dropOffTripStop,
      segments,
    );
    const claimed = new Set(
      booking.reservedSeatSegments.map((claim) => claim.tripSegmentId),
    );
    if (!traversed.every((segment) => claimed.has(segment.id))) {
      throw new BoardingPersistenceError("INVALID_JOURNEY");
    }

    await transaction.booking.update({
      where: { id: booking.id },
      data: { checkedInAt: now, checkInMethod: method },
    });
    return {
      outcome: "BOARDED" as const,
      tripId,
      bookingId: booking.id,
      passengerName: booking.student.name,
      studentId: booking.student.studentId,
      seatNumber: booking.tripSeat.seatNumber,
    };
  });
}

export async function admitWalkInRecord(
  actor: BoardingActorRecord,
  tripId: string,
  intentId: string,
  method: CheckInMethod,
  now: Date,
  policy: ProductPolicy,
  expectedPass?: ExpectedPassRecord,
) {
  return prisma.$transaction(async (transaction) => {
    await lockTrip(transaction, tripId);
    const { trip } = await authorizeOperator(transaction, actor, tripId);
    const intent = await transaction.walkInIntent.findUnique({
      where: { id: intentId },
      include: {
        boardingTripStop: true,
        dropOffTripStop: true,
        journey: { include: { standingClaims: true } },
        student: { select: { id: true, name: true, studentId: true } },
      },
    });
    if (!intent) throw new BoardingPersistenceError("INTENT_NOT_FOUND");
    if (intent.tripId !== tripId) throw new BoardingPersistenceError("WRONG_TRIP");
    assertExpectedPass(expectedPass, intent);
    if (intent.journey) {
      return {
        outcome: "ALREADY_BOARDED" as const,
        tripId,
        walkInIntentId: intent.id,
        walkInJourneyId: intent.journey.id,
        passengerName: intent.student.name,
        studentId: intent.student.studentId,
        claimsCreated: intent.journey.standingClaims.length,
      };
    }
    if (intent.status !== "PENDING" || intent.expiresAt <= now) {
      throw new BoardingPersistenceError("INVALID_STATE");
    }
    assertBoardable(now, trip.status, intent.boardingTripStop, policy);

    const allSegments = await transaction.tripSegment.findMany({
      where: { tripId },
      orderBy: { position: "asc" },
      select: { id: true, tripId: true, position: true },
    });
    const traversed = deriveJourneySegments(
      intent.boardingTripStop,
      intent.dropOffTripStop,
      allSegments,
    );
    const ids = traversed.map((segment) => segment.id);
    if (ids.length === 0) throw new BoardingPersistenceError("INVALID_JOURNEY");
    const lockedSegmentIds = Prisma.join(
      ids.map((segmentId) => Prisma.sql`${segmentId}::uuid`),
    );

    await transaction.$queryRaw`
      SELECT "id"
      FROM "TripSegment"
      WHERE "tripId" = ${tripId}
        AND "id" IN (${lockedSegmentIds})
      ORDER BY "position" ASC
      FOR UPDATE
    `;
    const counts = await transaction.standingSegmentClaim.groupBy({
      by: ["tripSegmentId"],
      where: { tripId, tripSegmentId: { in: ids } },
      _count: { id: true },
    });
    const countBySegment = new Map(
      counts.map((count) => [count.tripSegmentId, count._count.id]),
    );
    if (
      ids.some(
        (segmentId) =>
          (countBySegment.get(segmentId) ?? 0) >= trip.standingCapacity,
      )
    ) {
      await transaction.walkInIntent.update({
        where: { id: intent.id },
        data: { status: "REJECTED_FULL" },
      });
      return {
        outcome: "FULL" as const,
        tripId,
        walkInIntentId: intent.id,
      };
    }

    const journeyData: Prisma.WalkInJourneyUncheckedCreateInput = {
      walkInIntentId: intent.id,
      studentId: intent.studentId,
      tripId,
      boardingTripStopId: intent.boardingTripStopId,
      dropOffTripStopId: intent.dropOffTripStopId,
      boardedAt: now,
      boardingMethod: method,
    };
    const journey = await transaction.walkInJourney.create({
      data: journeyData,
    });
    await transaction.standingSegmentClaim.createMany({
      data: ids.map((tripSegmentId) => ({
        walkInJourneyId: journey.id,
        tripId,
        tripSegmentId,
      })),
    });
    await transaction.walkInIntent.update({
      where: { id: intent.id },
      data: { status: "BOARDED" },
    });
    return {
      outcome: "BOARDED" as const,
      tripId,
      walkInIntentId: intent.id,
      walkInJourneyId: journey.id,
      passengerName: intent.student.name,
      studentId: intent.student.studentId,
      claimsCreated: ids.length,
    };
  });
}

function assertCurrentDropOff(
  stop: {
    actualArrival: Date | null;
    actualDeparture: Date | null;
    passedAt: Date | null;
  },
): void {
  if (!stop.actualArrival || stop.actualDeparture || stop.passedAt) {
    throw new BoardingPersistenceError("ALIGHTING_NOT_ALLOWED");
  }
}

export async function confirmAlightingRecord(
  actor: BoardingActorRecord,
  tripId: string,
  kind: "RESERVED" | "WALK_IN",
  recordId: string,
  method: "QR" | "MANUAL",
  now: Date,
  expectedPass?: ExpectedPassRecord,
) {
  return prisma.$transaction(async (transaction) => {
    await lockTrip(transaction, tripId);
    await authorizeOperator(transaction, actor, tripId);
    if (kind === "RESERVED") {
      const booking = await transaction.booking.findUnique({
        where: { id: recordId },
        include: { dropOffTripStop: true },
      });
      if (!booking) throw new BoardingPersistenceError("BOOKING_NOT_FOUND");
      if (booking.tripId !== tripId) throw new BoardingPersistenceError("WRONG_TRIP");
      assertExpectedPass(expectedPass, booking);
      if (booking.actualAlightedAt) {
        return { outcome: "ALREADY_ALIGHTED" as const, tripId, kind, recordId };
      }
      if (!booking.checkedInAt || booking.status !== "CONFIRMED") {
        throw new BoardingPersistenceError("INVALID_STATE");
      }
      assertCurrentDropOff(booking.dropOffTripStop);
      await transaction.booking.update({
        where: { id: booking.id },
        data: {
          status: "COMPLETED",
          actualAlightedAt: now,
          alightingMethod: method,
        },
      });
      return { outcome: "ALIGHTED" as const, tripId, kind, recordId };
    }

    const journey = await transaction.walkInJourney.findUnique({
      where: { id: recordId },
      include: { dropOffTripStop: true },
    });
    if (!journey) throw new BoardingPersistenceError("JOURNEY_NOT_FOUND");
    if (journey.tripId !== tripId) throw new BoardingPersistenceError("WRONG_TRIP");
    assertExpectedPass(expectedPass, journey);
    if (journey.actualAlightedAt) {
      return { outcome: "ALREADY_ALIGHTED" as const, tripId, kind, recordId };
    }
    if (journey.status !== "BOARDED") {
      throw new BoardingPersistenceError("INVALID_STATE");
    }
    assertCurrentDropOff(journey.dropOffTripStop);
    await transaction.walkInJourney.update({
      where: { id: journey.id },
      data: {
        status: "COMPLETED",
        actualAlightedAt: now,
        alightingMethod: method,
      },
    });
    return { outcome: "ALIGHTED" as const, tripId, kind, recordId };
  });
}

async function autoCompleteAtStop(
  transaction: Transaction,
  tripId: string,
  tripStopId: string,
  now: Date,
) {
  const [reserved, walkIn] = await Promise.all([
    transaction.booking.updateMany({
      where: {
        tripId,
        dropOffTripStopId: tripStopId,
        status: "CONFIRMED",
        checkedInAt: { not: null },
        actualAlightedAt: null,
      },
      data: {
        status: "COMPLETED",
        actualAlightedAt: now,
        alightingMethod: "AUTO_PLANNED_STOP",
      },
    }),
    transaction.walkInJourney.updateMany({
      where: {
        tripId,
        dropOffTripStopId: tripStopId,
        status: "BOARDED",
        actualAlightedAt: null,
      },
      data: {
        status: "COMPLETED",
        actualAlightedAt: now,
        alightingMethod: "AUTO_PLANNED_STOP",
      },
    }),
  ]);
  return { reserved: reserved.count, walkIn: walkIn.count };
}

export async function progressTripRecord(
  actor: BoardingActorRecord,
  tripId: string,
  input:
    | { action: "START_BOARDING" }
    | { action: "ARRIVE_NEXT_STOP" }
    | { action: "DEPART_CURRENT_STOP" }
    | { action: "SET_DELAY"; delayMinutes: number; reason: string },
  now: Date,
  policy: ProductPolicy,
) {
  return prisma.$transaction(async (transaction) => {
    await lockTrip(transaction, tripId);
    const { actor: liveActor } = await authorizeOperator(transaction, actor, tripId);
    const trip = await transaction.trip.findUnique({
      where: { id: tripId },
      include: { tripStops: { orderBy: { position: "asc" } } },
    });
    if (!trip) throw new BoardingPersistenceError("TRIP_NOT_FOUND");

    if (input.action === "SET_DELAY") {
      if (trip.status === "ARRIVED" || trip.status === "CANCELLED") {
        throw new BoardingPersistenceError("ILLEGAL_TRIP_TRANSITION");
      }
      const updated = await transaction.trip.update({
        where: { id: tripId },
        data: { delayMinutes: input.delayMinutes, delayReason: input.reason },
      });
      return { trip: updated, autoAlighted: { reserved: 0, walkIn: 0 } };
    }

    if (input.action === "START_BOARDING") {
      try {
        assertTripTransition(trip.status, "BOARDING");
      } catch {
        throw new BoardingPersistenceError("ILLEGAL_TRIP_TRANSITION");
      }
      const origin = trip.tripStops[0];
      if (!origin) throw new BoardingPersistenceError("INVALID_JOURNEY");
      const opensAt = origin.plannedDeparture.getTime() - policy.boardingOpenLeadMs;
      if (now.getTime() < opensAt) {
        throw new BoardingPersistenceError("BOARDING_CLOSED");
      }
      await transaction.tripStop.update({
        where: { id: origin.id },
        data: { actualArrival: origin.actualArrival ?? now },
      });
      await transaction.tripStatusHistory.create({
        data: {
          tripId,
          fromStatus: trip.status,
          toStatus: "BOARDING",
          actorId: liveActor.id,
          occurredAt: now,
        },
      });
      const updated = await transaction.trip.update({
        where: { id: tripId },
        data: { status: "BOARDING" },
      });
      return { trip: updated, currentTripStopId: origin.id, autoAlighted: { reserved: 0, walkIn: 0 } };
    }

    if (input.action === "ARRIVE_NEXT_STOP") {
      if (trip.status !== "DEPARTED") {
        throw new BoardingPersistenceError("ILLEGAL_TRIP_TRANSITION");
      }
      if (trip.tripStops.some((stop) => stop.actualArrival && !stop.actualDeparture)) {
        throw new BoardingPersistenceError("ILLEGAL_TRIP_TRANSITION");
      }
      const lastDeparted = [...trip.tripStops]
        .reverse()
        .find((stop) => stop.actualDeparture || stop.passedAt);
      const next = trip.tripStops.find(
        (stop) => stop.position === (lastDeparted?.position ?? -1) + 1,
      );
      if (!next) throw new BoardingPersistenceError("ILLEGAL_TRIP_TRANSITION");
      await transaction.tripStop.update({
        where: { id: next.id },
        data: { actualArrival: now },
      });
      return { trip, currentTripStopId: next.id, autoAlighted: { reserved: 0, walkIn: 0 } };
    }

    const current = trip.tripStops.find(
      (stop) => stop.actualArrival && !stop.actualDeparture && !stop.passedAt,
    );
    if (!current || (trip.status !== "BOARDING" && trip.status !== "DEPARTED")) {
      throw new BoardingPersistenceError("ILLEGAL_TRIP_TRANSITION");
    }
    await transaction.tripStop.update({
      where: { id: current.id },
      data: { actualDeparture: now, passedAt: now },
    });
    const autoAlighted = await autoCompleteAtStop(transaction, tripId, current.id, now);
    const noShows = await processNoShowsAtTripStopInTransaction(
      transaction,
      tripId,
      current.id,
      now,
      policy,
    );
    const isFinal = current.position === trip.tripStops.length - 1;
    const nextStatus = isFinal ? "ARRIVED" : "DEPARTED";
    if (nextStatus !== trip.status) {
      try {
        assertTripTransition(trip.status, nextStatus);
      } catch {
        throw new BoardingPersistenceError("ILLEGAL_TRIP_TRANSITION");
      }
      await transaction.tripStatusHistory.create({
        data: {
          tripId,
          fromStatus: trip.status,
          toStatus: nextStatus,
          actorId: liveActor.id,
          occurredAt: now,
        },
      });
    }
    const updated = await transaction.trip.update({
      where: { id: tripId },
      data: { status: nextStatus },
    });
    return {
      trip: updated,
      currentTripStopId: current.id,
      autoAlighted,
      noShows: {
        processed: noShows.processed.length,
        promoted: noShows.promoted.length,
      },
    };
  });
}

export async function loadStudentPassRecord(
  studentId: string,
  kind: "RESERVED" | "WALK_IN",
  recordId: string,
  purpose: "RESERVED_BOARDING" | "ALIGHTING",
  now?: Date,
  policy?: ProductPolicy,
) {
  if (kind === "RESERVED") {
    const booking = await prisma.booking.findUnique({
      where: { id: recordId },
      include: { boardingTripStop: true, trip: { select: { status: true } } },
    });
    if (!booking || booking.studentId !== studentId) {
      throw new BoardingPersistenceError("BOOKING_NOT_FOUND");
    }
    if (purpose === "RESERVED_BOARDING") {
      if (booking.status !== "CONFIRMED" || booking.checkedInAt) {
        throw new BoardingPersistenceError("INVALID_STATE");
      }
      if (!now || !policy) throw new BoardingPersistenceError("INVALID_STATE");
      assertBoardable(now, booking.trip.status, booking.boardingTripStop, policy);
    } else if (!booking.checkedInAt || booking.actualAlightedAt) {
      throw new BoardingPersistenceError("INVALID_STATE");
    }
    return { studentId, tripId: booking.tripId, recordId: booking.id };
  }
  const journey = await prisma.walkInJourney.findUnique({
    where: { id: recordId },
  });
  if (!journey || journey.studentId !== studentId) {
    throw new BoardingPersistenceError("JOURNEY_NOT_FOUND");
  }
  if (journey.status !== "BOARDED" || journey.actualAlightedAt) {
    throw new BoardingPersistenceError("INVALID_STATE");
  }
  return { studentId, tripId: journey.tripId, recordId: journey.id };
}

export async function getDriverManifestRecord(
  actor: BoardingActorRecord,
  tripId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await authorizeOperator(transaction, actor, tripId);
    const trip = await transaction.trip.findUnique({
      where: { id: tripId },
      include: {
        route: { select: { name: true } },
        bus: { select: { plateNumber: true } },
        tripStops: { orderBy: { position: "asc" } },
        bookings: {
          where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
          include: {
            student: { select: { name: true, studentId: true } },
            tripSeat: { select: { seatNumber: true } },
            boardingTripStop: { select: { id: true, stopName: true } },
            dropOffTripStop: { select: { id: true, stopName: true } },
          },
        },
        walkInJourneys: {
          include: {
            student: { select: { name: true, studentId: true } },
            boardingTripStop: { select: { stopName: true } },
            dropOffTripStop: { select: { id: true, stopName: true } },
          },
        },
      },
    });
    if (!trip) throw new BoardingPersistenceError("TRIP_NOT_FOUND");
    const currentStop = trip.tripStops.find(
      (stop) => stop.actualArrival && !stop.actualDeparture && !stop.passedAt,
    ) ?? null;
    return { trip, currentStop };
  });
}
