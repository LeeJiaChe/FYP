import type { IngestLocationInput } from "../contracts/location.schemas";
import {
  assertCoordinate,
  isRecordedAtReasonable,
  isTelemetryTripEligible,
  locationAgeMs,
  locationRetentionCutoff,
} from "../domain/location-policy";
import { simulatorCoordinateForSegment } from "../domain/simulator";
import {
  createLocationSample,
  deleteLocationSamplesBefore,
  findLatestLocationSample,
  findSimulatorTrip,
  findTelemetryTrip,
} from "../infrastructure/location.prisma.server";
import { currentOperationalSegmentPosition } from "@/features/trips/public";
import {
  conflict,
  notFound,
  validationError,
} from "@/shared/application/application-error";
import { productPolicy } from "@/shared/config/policies";
import { systemClock, type Clock } from "@/shared/time/clock";

export async function ingestLocation(
  input: IngestLocationInput,
  clock: Clock = systemClock,
) {
  try {
    assertCoordinate(input.latitude, input.longitude);
  } catch (error) {
    throw validationError(error instanceof Error ? error.message : "Invalid coordinates");
  }
  const recordedAt = new Date(input.recordedAt);
  if (!isRecordedAtReasonable(recordedAt, clock.now())) {
    throw validationError("recordedAt is invalid or too far in the future");
  }
  const trip = await findTelemetryTrip(input.tripId);
  if (!trip) throw notFound("Trip not found");
  if (!isTelemetryTripEligible(trip.status)) {
    throw conflict("Trip is not operationally eligible for telemetry");
  }
  return createLocationSample({ ...input, recordedAt });
}

export async function latestLocation(tripId: string, clock: Clock = systemClock) {
  const trip = await findTelemetryTrip(tripId);
  if (!trip) throw notFound("Trip not found");
  const sample = await findLatestLocationSample(tripId);
  if (!sample) return null;
  return {
    tripId: sample.tripId,
    latitude: sample.latitude.toNumber(),
    longitude: sample.longitude.toNumber(),
    recordedAt: sample.recordedAt,
    source: sample.source,
    ageMs: locationAgeMs(sample.recordedAt, clock.now()),
  };
}

export async function simulateLocation(
  preferredTripId: string | undefined,
  clock: Clock = systemClock,
) {
  const trip = await findSimulatorTrip(preferredTripId);
  if (!trip) throw notFound("No operational Trip is available to simulate");
  const position = currentOperationalSegmentPosition(trip.status, trip.tripStops);
  if (position === null) throw conflict("Trip has no current operational segment");
  const from = trip.tripStops[position];
  const to = trip.tripStops[position + 1];
  if (!from || !to) throw conflict("Trip snapshot has no simulatable segment");
  const now = clock.now();
  const coordinate = simulatorCoordinateForSegment(
    {
      ...from,
      latitude: from.latitude.toNumber(),
      longitude: from.longitude.toNumber(),
    },
    {
      ...to,
      latitude: to.latitude.toNumber(),
      longitude: to.longitude.toNumber(),
    },
    now,
  );
  return ingestLocation(
    {
      tripId: trip.id,
      ...coordinate,
      recordedAt: now.toISOString(),
      source: "SIMULATED",
    },
    clock,
  );
}

export async function retainRecentLocations(clock: Clock = systemClock) {
  const cutoff = locationRetentionCutoff(clock.now(), productPolicy.locationRetentionMs);
  const result = await deleteLocationSamplesBefore(cutoff);
  return { deleted: result.count, cutoff };
}

