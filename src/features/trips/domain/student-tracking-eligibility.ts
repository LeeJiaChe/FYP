export type StudentTrackingState = "UPCOMING" | "LIVE" | "UNAVAILABLE";

export function resolveStudentTrackingState(
  tripStatus: string,
  departureTime: Date,
  now: Date,
): StudentTrackingState {
  if (tripStatus === "BOARDING" || tripStatus === "DEPARTED") return "LIVE";
  if (tripStatus === "NOT_STARTED" && departureTime.getTime() >= now.getTime()) {
    return "UPCOMING";
  }
  return "UNAVAILABLE";
}
