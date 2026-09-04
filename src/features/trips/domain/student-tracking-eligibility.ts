export type StudentTrackingState =
  | "UPCOMING"
  | "AWAITING_OPERATION"
  | "LIVE"
  | "UNAVAILABLE";

export function resolveStudentTrackingState(
  tripStatus: string,
  departureTime: Date,
  now: Date,
): StudentTrackingState {
  if (tripStatus === "BOARDING" || tripStatus === "DEPARTED") return "LIVE";
  if (tripStatus === "NOT_STARTED") {
    return departureTime.getTime() >= now.getTime()
      ? "UPCOMING"
      : "AWAITING_OPERATION";
  }
  return "UNAVAILABLE";
}
