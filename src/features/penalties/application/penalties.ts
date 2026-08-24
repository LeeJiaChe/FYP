import type {
  ResolvePenaltyAppealInput,
  SubmitPenaltyAppealInput,
} from "../contracts/penalty.types";
import {
  listAdminAppealRecords,
  listStudentPenaltyRecords,
  PenaltyPersistenceError,
  processNoShowsAtTripStopRecord,
  reconcileNoShowRecords,
  resolveAppealRecord,
  submitAppealRecord,
} from "../infrastructure/penalty.prisma.server";
import {
  conflict,
  forbidden,
  notFound,
} from "@/shared/application/application-error";
import { productPolicy, type ProductPolicy } from "@/shared/config/policies";
import { systemClock, type Clock } from "@/shared/time/clock";
import { isBookingRestricted } from "../domain/credit-policy";

export interface PenaltyActor {
  readonly userId: string;
  readonly role: string;
}

function requireStudent(actor: PenaltyActor): void {
  if (actor.role !== "STUDENT") throw forbidden("Student role required");
}

function requireAdmin(actor: PenaltyActor): void {
  if (actor.role !== "ADMIN") throw forbidden("Administrator role required");
}

function mapFailure(error: PenaltyPersistenceError): never {
  switch (error.code) {
    case "PENALTY_NOT_FOUND":
      throw notFound("Penalty not found");
    case "APPEAL_NOT_FOUND":
      throw notFound("Appeal not found");
    case "FORBIDDEN":
      throw forbidden("The requested penalty does not belong to this student");
    case "NOT_APPEALABLE":
      throw conflict("Penalty is not eligible for appeal");
    case "APPEAL_EXISTS":
      throw conflict("An appeal already exists for this penalty");
    case "APPEAL_NOT_PENDING":
      throw conflict("Appeal has already been resolved");
  }
}

async function translate<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PenaltyPersistenceError) mapFailure(error);
    throw error;
  }
}

export async function processNoShowsAtTripStop(
  tripId: string,
  tripStopId: string,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  return translate(() =>
    processNoShowsAtTripStopRecord(
      tripId,
      tripStopId,
      clock.now(),
      policy,
    ),
  );
}

export async function reconcileNoShows(
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  const results = await translate(() =>
    reconcileNoShowRecords(clock.now(), policy),
  );
  return {
    candidateStops: results.length,
    processed: results.reduce(
      (total, result) => total + result.processed.length,
      0,
    ),
    promoted: results.reduce(
      (total, result) => total + result.promoted.length,
      0,
    ),
    results,
  };
}

export async function listMyPenalties(
  actor: PenaltyActor,
  policy: ProductPolicy = productPolicy,
) {
  requireStudent(actor);
  const records = await translate(() =>
    listStudentPenaltyRecords(actor.userId),
  );
  return {
    userCreditScore: records.student.creditScore,
    isBookingRestricted: isBookingRestricted(
      records.student.creditScore,
      policy,
    ),
    policy: {
      maximumCredit: policy.initialCredit,
      noShowPenaltyPoints: policy.noShowPenaltyPoints,
      bookingRestrictionBelowCredit:
        policy.bookingRestrictionBelowCredit,
    },
    penalties: records.penalties.map((penalty) => ({
      id: penalty.id,
      type: penalty.type,
      creditPointsDeducted: penalty.creditPointsDeducted,
      reason: penalty.reason,
      status: penalty.status,
      createdAt: penalty.createdAt,
      booking: {
        id: penalty.booking.id,
        routeName: penalty.booking.trip.route.name,
        busPlateNumber: penalty.booking.trip.bus.plateNumber,
        seatNumber: penalty.booking.tripSeat.seatNumber,
        boardingStopName: penalty.booking.boardingTripStop.stopName,
        dropOffStopName: penalty.booking.dropOffTripStop.stopName,
        departureTime: penalty.booking.boardingTripStop.plannedDeparture,
      },
      appeal: penalty.appeal
        ? {
            id: penalty.appeal.id,
            reason: penalty.appeal.reason,
            status: penalty.appeal.status,
            adminComment: penalty.appeal.adminComment,
            createdAt: penalty.appeal.createdAt,
            resolvedAt: penalty.appeal.resolvedAt,
          }
        : null,
    })),
  };
}

export async function submitPenaltyAppeal(
  actor: PenaltyActor,
  penaltyId: string,
  input: SubmitPenaltyAppealInput,
) {
  requireStudent(actor);
  const appeal = await translate(() =>
    submitAppealRecord(actor.userId, penaltyId, input.reason),
  );
  return { id: appeal.id, penaltyId, status: appeal.status };
}

export async function listAppealsForAdmin(actor: PenaltyActor) {
  requireAdmin(actor);
  const appeals = await listAdminAppealRecords();
  return appeals.map((appeal) => ({
    id: appeal.id,
    penaltyId: appeal.penaltyId,
    studentName: appeal.student.name,
    studentId: appeal.student.studentId,
    creditPointsDeducted: appeal.penalty.creditPointsDeducted,
    penaltyReason: appeal.penalty.reason,
    appealReason: appeal.reason,
    status: appeal.status,
    adminComment: appeal.adminComment,
    reviewedBy: appeal.reviewedByAdmin?.name ?? null,
    createdAt: appeal.createdAt,
    resolvedAt: appeal.resolvedAt,
    journey: {
      routeName: appeal.penalty.booking.trip.route.name,
      seatNumber: appeal.penalty.booking.tripSeat.seatNumber,
      boardingStopName: appeal.penalty.booking.boardingTripStop.stopName,
      dropOffStopName: appeal.penalty.booking.dropOffTripStop.stopName,
      boardingDeparture:
        appeal.penalty.booking.boardingTripStop.plannedDeparture,
    },
  }));
}

export async function resolvePenaltyAppeal(
  actor: PenaltyActor,
  appealId: string,
  input: ResolvePenaltyAppealInput,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  requireAdmin(actor);
  return translate(() =>
    resolveAppealRecord(
      actor.userId,
      appealId,
      input.status,
      input.adminComment,
      clock.now(),
      policy,
    ),
  );
}
