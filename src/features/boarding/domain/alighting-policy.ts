export type AlightingMethodValue = "QR" | "MANUAL" | "AUTO_PLANNED_STOP";

export function shouldAutoCompleteAtPlannedStop(stop: {
  readonly actualDeparture: Date | null;
  readonly passedAt: Date | null;
}): boolean {
  return stop.actualDeparture !== null || stop.passedAt !== null;
}

export function isAlightingComplete(value: {
  readonly actualAlightedAt: Date | null;
  readonly alightingMethod: AlightingMethodValue | null;
}): boolean {
  return value.actualAlightedAt !== null && value.alightingMethod !== null;
}
