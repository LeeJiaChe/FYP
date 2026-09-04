import "server-only";

import { timingSafeEqual } from "node:crypto";

import {
  ingestLocation as ingestLocationUseCase,
  retainRecentLocations as retainRecentLocationsUseCase,
  simulateLocation as simulateLocationUseCase,
} from "./application/location";
import { notifyRealtime } from "@/lib/realtime-client";
import { unauthenticated } from "@/shared/application/application-error";
import { serverEnvironment } from "@/shared/config/env.server";

export {
  ingestLocationSchema,
  locationTripIdSchema,
  simulateLocationSchema,
} from "./contracts/location.schemas";
export { latestLocation } from "./application/location";
export { assertCoordinate } from "./domain/location-policy";

function trusted(candidate: string | null): void {
  if (!candidate) throw unauthenticated("Trusted service authentication failed");
  const expected = Buffer.from(serverEnvironment.realtime.serviceSecret);
  const supplied = Buffer.from(candidate);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw unauthenticated("Trusted service authentication failed");
  }
}

async function publishLocation(sample: { tripId: string; recordedAt: Date }) {
  await notifyRealtime(`trip:${sample.tripId}`, "location.changed", {
    entityId: sample.tripId,
    changedAt: sample.recordedAt.toISOString(),
    reason: "LOCATION_RECORDED",
  });
}

export async function ingestTrustedLocation(
  secret: string | null,
  input: Parameters<typeof ingestLocationUseCase>[0],
) {
  trusted(secret);
  const sample = await ingestLocationUseCase(input);
  await publishLocation(sample);
  return sample;
}

export async function simulateTrustedLocation(secret: string | null, tripId?: string) {
  trusted(secret);
  const sample = tripId
    ? await simulateLocationUseCase(tripId)
    : await simulateLocationUseCase();
  if (sample) await publishLocation(sample);
  return sample;
}

export async function retainRecentLocations(secret: string | null) {
  trusted(secret);
  return retainRecentLocationsUseCase();
}
