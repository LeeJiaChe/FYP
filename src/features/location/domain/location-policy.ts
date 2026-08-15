export const LOCATION_FUTURE_TOLERANCE_MS = 2 * 60 * 1_000;

export function isTelemetryTripEligible(status: string): boolean {
  return status === "BOARDING" || status === "DEPARTED";
}

export function assertCoordinate(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError("Latitude must be between -90 and 90");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError("Longitude must be between -180 and 180");
  }
}

export function isRecordedAtReasonable(
  recordedAt: Date,
  now: Date,
  futureToleranceMs = LOCATION_FUTURE_TOLERANCE_MS,
): boolean {
  return Number.isFinite(recordedAt.getTime()) &&
    recordedAt.getTime() <= now.getTime() + futureToleranceMs;
}

export function locationAgeMs(recordedAt: Date, now: Date): number {
  return Math.max(0, now.getTime() - recordedAt.getTime());
}

export function locationRetentionCutoff(now: Date, retentionMs: number): Date {
  return new Date(now.getTime() - retentionMs);
}

