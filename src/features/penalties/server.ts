import "server-only";

import { timingSafeEqual } from "node:crypto";

import {
  processNoShowsAtTripStop as processNoShowsAtTripStopUseCase,
  reconcileNoShows as reconcileNoShowsUseCase,
  resolvePenaltyAppeal as resolvePenaltyAppealUseCase,
  submitPenaltyAppeal as submitPenaltyAppealUseCase,
} from "./application/penalties";
import { notifyRealtime } from "@/lib/realtime-client";
import { unauthenticated } from "@/shared/application/application-error";
import { serverEnvironment } from "@/shared/config/env.server";

export {
  listAppealsForAdmin,
  listMyPenalties,
} from "./application/penalties";
export {
  appealIdSchema,
  penaltyIdSchema,
  resolvePenaltyAppealSchema,
  submitPenaltyAppealSchema,
} from "./contracts/penalty.schemas";
export { processNoShowsAtTripStopInTransaction } from "./infrastructure/penalty.prisma.server";

function trustedServiceSecretMatches(candidate: string | null): boolean {
  if (!candidate) return false;
  const expected = Buffer.from(serverEnvironment.realtime.serviceSecret);
  const supplied = Buffer.from(candidate);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function publishPenaltyChanges(result: {
  readonly processed: readonly { studentId: string }[];
  readonly promoted: readonly unknown[];
  readonly tripId: string;
}) {
  if (result.processed.length === 0 && result.promoted.length === 0) return;
  await notifyRealtime(`trip:${result.tripId}`, "occupancy.changed", {
    entityId: result.tripId,
    changedAt: new Date().toISOString(),
    reason: "NO_SHOW_RECONCILED",
  });
  for (const studentId of new Set(result.processed.map((item) => item.studentId))) {
    await notifyRealtime(`user:${studentId}`, "notification.changed", {
      entityId: studentId,
      changedAt: new Date().toISOString(),
      reason: "PENALTY_ISSUED",
    });
  }
}

export async function processNoShowsAtTripStop(
  ...args: Parameters<typeof processNoShowsAtTripStopUseCase>
) {
  const result = await processNoShowsAtTripStopUseCase(...args);
  await publishPenaltyChanges(result);
  return result;
}

export async function reconcileNoShows(serviceSecret: string | null) {
  if (!trustedServiceSecretMatches(serviceSecret)) {
    throw unauthenticated("Trusted service authentication failed");
  }
  const result = await reconcileNoShowsUseCase();
  for (const item of result.results) await publishPenaltyChanges(item);
  return {
    candidateStops: result.candidateStops,
    processed: result.processed,
    promoted: result.promoted,
  };
}

export async function submitPenaltyAppeal(
  ...args: Parameters<typeof submitPenaltyAppealUseCase>
) {
  return submitPenaltyAppealUseCase(...args);
}

export async function resolvePenaltyAppeal(
  ...args: Parameters<typeof resolvePenaltyAppealUseCase>
) {
  const result = await resolvePenaltyAppealUseCase(...args);
  await notifyRealtime("admins", "notification.changed", {
    entityId: result.appealId,
    changedAt: new Date().toISOString(),
    reason: "APPEAL_RESOLVED",
  });
  return result;
}
