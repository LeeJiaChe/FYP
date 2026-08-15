import "server-only";

import { Prisma } from "@prisma/client";

import { promoteCompatibleWaitlistInTransaction } from "@/features/bookings/server";
import type { ProductPolicy } from "@/shared/config/policies";
import { prisma } from "@/shared/db/prisma.server";
import { deductNoShowCredit, restoreCredit } from "../domain/credit-policy";
import { isReservedNoShow } from "../domain/no-show-policy";
import {
  assertAppealPending,
  assertPenaltyCanBeAppealed,
  penaltyStatusForAppealDecision,
  PenaltyLifecycleError,
} from "../domain/penalty-lifecycle";

type Transaction = Prisma.TransactionClient;

export type PenaltyPersistenceFailure =
  | "PENALTY_NOT_FOUND"
  | "APPEAL_NOT_FOUND"
  | "FORBIDDEN"
  | "NOT_APPEALABLE"
  | "APPEAL_EXISTS"
  | "APPEAL_NOT_PENDING";

export class PenaltyPersistenceError extends Error {
  constructor(readonly code: PenaltyPersistenceFailure) {
    super(code);
    this.name = "PenaltyPersistenceError";
  }
}

async function lockTrip(transaction: Transaction, tripId: string): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE
  `;
  if (rows.length !== 1) throw new PenaltyPersistenceError("PENALTY_NOT_FOUND");
}

async function lockUserCredit(
  transaction: Transaction,
  userId: string,
): Promise<number> {
  const rows = await transaction.$queryRaw<Array<{ creditScore: number }>>`
    SELECT "creditScore" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  if (rows.length !== 1) throw new PenaltyPersistenceError("PENALTY_NOT_FOUND");
  return rows[0]!.creditScore;
}

export async function processNoShowsAtTripStopInTransaction(
  transaction: Transaction,
  tripId: string,
  tripStopId: string,
  now: Date,
  policy: ProductPolicy,
) {
  const stop = await transaction.tripStop.findFirst({
    where: { id: tripStopId, tripId },
    select: {
      id: true,
      stopName: true,
      actualDeparture: true,
      passedAt: true,
    },
  });
  if (!stop || (!stop.actualDeparture && !stop.passedAt)) {
    return { tripId, tripStopId, processed: [], promoted: [] };
  }

  const candidates = await transaction.booking.findMany({
    where: {
      tripId,
      boardingTripStopId: tripStopId,
      status: "CONFIRMED",
      checkedInAt: null,
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  const processed: Array<{
    bookingId: string;
    penaltyId: string;
    studentId: string;
    creditPointsDeducted: number;
    creditScore: number;
  }> = [];

  for (const candidate of candidates) {
    await transaction.$queryRaw`
      SELECT "id" FROM "Booking" WHERE "id" = ${candidate.id} FOR UPDATE
    `;
    const booking = await transaction.booking.findUnique({
      where: { id: candidate.id },
      include: { boardingTripStop: true },
    });
    if (
      !booking ||
      !isReservedNoShow({
        bookingStatus: booking.status,
        checkedInAt: booking.checkedInAt,
        boardingActualDeparture: booking.boardingTripStop.actualDeparture,
        boardingPassedAt: booking.boardingTripStop.passedAt,
      })
    ) {
      continue;
    }

    const existingPenalty = await transaction.penalty.findUnique({
      where: { bookingId: booking.id },
    });
    await transaction.booking.update({
      where: { id: booking.id },
      data: { status: "NO_SHOW" },
    });
    await transaction.reservedSeatSegment.deleteMany({
      where: { bookingId: booking.id },
    });
    if (existingPenalty) continue;

    const currentCredit = await lockUserCredit(transaction, booking.studentId);
    const deduction = deductNoShowCredit(currentCredit, policy);
    const penalty = await transaction.penalty.create({
      data: {
        bookingId: booking.id,
        studentId: booking.studentId,
        type: "RESERVED_NO_SHOW",
        creditPointsDeducted: deduction.pointsChanged,
        reason: `Reserved journey no-show at ${stop.stopName}`,
        status: "ACTIVE",
      },
    });
    await transaction.user.update({
      where: { id: booking.studentId },
      data: { creditScore: deduction.score },
    });
    await transaction.notification.create({
      data: {
        userId: booking.studentId,
        type: "PENALTY_ISSUED",
        deduplicationKey: `penalty-issued:${penalty.id}`,
        message: `A reserved no-show penalty deducted ${deduction.pointsChanged} credit points for ${stop.stopName}.`,
      },
    });
    processed.push({
      bookingId: booking.id,
      penaltyId: penalty.id,
      studentId: booking.studentId,
      creditPointsDeducted: deduction.pointsChanged,
      creditScore: deduction.score,
    });
  }

  const promoted =
    processed.length > 0
      ? await promoteCompatibleWaitlistInTransaction(
          transaction,
          tripId,
          now,
          policy,
        )
      : [];
  return { tripId, tripStopId, processed, promoted };
}

export async function processNoShowsAtTripStopRecord(
  tripId: string,
  tripStopId: string,
  now: Date,
  policy: ProductPolicy,
) {
  return prisma.$transaction(async (transaction) => {
    await lockTrip(transaction, tripId);
    return processNoShowsAtTripStopInTransaction(
      transaction,
      tripId,
      tripStopId,
      now,
      policy,
    );
  });
}

export async function reconcileNoShowRecords(now: Date, policy: ProductPolicy) {
  const candidates = await prisma.tripStop.findMany({
    where: {
      OR: [{ actualDeparture: { not: null } }, { passedAt: { not: null } }],
      boardingBookings: {
        some: { status: "CONFIRMED", checkedInAt: null },
      },
    },
    select: { id: true, tripId: true },
    orderBy: { plannedDeparture: "asc" },
    take: 100,
  });
  const results = [];
  for (const candidate of candidates) {
    results.push(
      await processNoShowsAtTripStopRecord(
        candidate.tripId,
        candidate.id,
        now,
        policy,
      ),
    );
  }
  return results;
}

export async function listStudentPenaltyRecords(studentId: string) {
  const [student, penalties] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { creditScore: true },
    }),
    prisma.penalty.findMany({
      where: { studentId },
      include: {
        booking: {
          include: {
            tripSeat: { select: { seatNumber: true } },
            boardingTripStop: { select: { stopName: true, plannedDeparture: true } },
            dropOffTripStop: { select: { stopName: true } },
            trip: {
              include: {
                route: { select: { name: true } },
                bus: { select: { plateNumber: true } },
              },
            },
          },
        },
        appeal: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!student) throw new PenaltyPersistenceError("FORBIDDEN");
  return { student, penalties };
}

export async function submitAppealRecord(
  studentId: string,
  penaltyId: string,
  reason: string,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id" FROM "Penalty" WHERE "id" = ${penaltyId} FOR UPDATE
      `;
      const penalty = await transaction.penalty.findUnique({
        where: { id: penaltyId },
        include: { appeal: true },
      });
      if (!penalty) throw new PenaltyPersistenceError("PENALTY_NOT_FOUND");
      if (penalty.studentId !== studentId) {
        throw new PenaltyPersistenceError("FORBIDDEN");
      }
      if (penalty.appeal) throw new PenaltyPersistenceError("APPEAL_EXISTS");
      try {
        assertPenaltyCanBeAppealed(penalty.status);
      } catch (error) {
        if (error instanceof PenaltyLifecycleError) {
          throw new PenaltyPersistenceError("NOT_APPEALABLE");
        }
        throw error;
      }
      const appeal = await transaction.penaltyAppeal.create({
        data: { penaltyId, studentId, reason, status: "PENDING" },
      });
      await transaction.penalty.update({
        where: { id: penaltyId },
        data: { status: "APPEALED" },
      });
      return appeal;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PenaltyPersistenceError("APPEAL_EXISTS");
    }
    throw error;
  }
}

export async function listAdminAppealRecords() {
  return prisma.penaltyAppeal.findMany({
    include: {
      student: { select: { name: true, studentId: true } },
      penalty: {
        include: {
          booking: {
            include: {
              tripSeat: { select: { seatNumber: true } },
              boardingTripStop: { select: { stopName: true, plannedDeparture: true } },
              dropOffTripStop: { select: { stopName: true } },
              trip: { include: { route: { select: { name: true } } } },
            },
          },
        },
      },
      reviewedByAdmin: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function resolveAppealRecord(
  adminId: string,
  appealId: string,
  decision: "APPROVED" | "REJECTED",
  adminComment: string,
  now: Date,
  policy: ProductPolicy,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "PenaltyAppeal" WHERE "id" = ${appealId} FOR UPDATE
    `;
    const appeal = await transaction.penaltyAppeal.findUnique({
      where: { id: appealId },
      include: { penalty: true },
    });
    if (!appeal) throw new PenaltyPersistenceError("APPEAL_NOT_FOUND");
    if (appeal.status !== "PENDING") {
      return {
        outcome: "ALREADY_RESOLVED" as const,
        appealId,
        status: appeal.status,
        penaltyStatus: appeal.penalty.status,
      };
    }
    try {
      assertAppealPending(appeal.status);
    } catch {
      throw new PenaltyPersistenceError("APPEAL_NOT_PENDING");
    }

    const currentCredit = await lockUserCredit(transaction, appeal.studentId);
    const penaltyStatus = penaltyStatusForAppealDecision(decision);
    let creditScore = currentCredit;
    if (decision === "APPROVED") {
      creditScore = restoreCredit(
        currentCredit,
        appeal.penalty.creditPointsDeducted,
        policy,
      ).score;
      await transaction.user.update({
        where: { id: appeal.studentId },
        data: { creditScore },
      });
    }
    await transaction.penaltyAppeal.update({
      where: { id: appeal.id },
      data: {
        status: decision,
        reviewedByAdminId: adminId,
        adminComment: adminComment || null,
        resolvedAt: now,
      },
    });
    await transaction.penalty.update({
      where: { id: appeal.penaltyId },
      data: { status: penaltyStatus },
    });
    await transaction.notification.create({
      data: {
        userId: appeal.studentId,
        type: "APPEAL_RESOLVED",
        deduplicationKey: `appeal-resolved:${appeal.id}`,
        message:
          decision === "APPROVED"
            ? `Your penalty appeal was approved. ${appeal.penalty.creditPointsDeducted} credit points were restored.${adminComment ? ` Staff note: ${adminComment}` : ""}`
            : `Your penalty appeal was rejected and the deduction remains.${adminComment ? ` Staff note: ${adminComment}` : ""}`,
      },
    });
    return {
      outcome: "RESOLVED" as const,
      appealId,
      status: decision,
      penaltyStatus,
      creditScore,
    };
  });
}
