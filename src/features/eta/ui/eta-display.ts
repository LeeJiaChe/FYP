import type {
  EtaFallbackReason,
  EtaSource,
  StopEta,
  TripEta,
} from "../contracts/eta.schemas";

type LocationSource = TripEta["locationSource"];
type TripStatus = TripEta["tripStatus"];

const scheduleFallbackLabels: Record<
  Exclude<EtaFallbackReason, null>,
  string
> = {
  DISABLED: "Schedule estimate",
  NO_API_KEY: "Schedule estimate",
  NO_LOCATION: "Schedule estimate · location unavailable",
  STALE_LOCATION: "Schedule estimate · location outdated",
  NO_ROUTE: "Schedule estimate · traffic route unavailable",
  API_TIMEOUT: "Schedule estimate · traffic service timed out",
  API_ERROR: "Schedule estimate · traffic service unavailable",
  INVALID_ROUTE_DATA: "Schedule estimate · route data unavailable",
};

export function etaSourceLabel(
  source: EtaSource,
  fallbackReason: EtaFallbackReason,
): string {
  if (source === "TRAFFIC_AWARE") return "Traffic-Aware";
  return fallbackReason
    ? scheduleFallbackLabels[fallbackReason]
    : "Schedule estimate";
}

export function etaSourceDisclosure(
  source: EtaSource,
  locationSource: LocationSource,
  fallbackReason: EtaFallbackReason,
): string {
  if (source === "SCHEDULE_ESTIMATE") {
    return etaSourceLabel(source, fallbackReason);
  }

  if (locationSource === "SIMULATED") {
    return "Based on simulated shuttle location";
  }
  if (locationSource === "GPS") return "Live GPS telemetry";
  return "Traffic-aware estimate";
}

const shuttleTimeFormatter = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatShuttleTime(isoTimestamp: string): string {
  return shuttleTimeFormatter.format(new Date(isoTimestamp));
}

export function terminalTripMessage(tripStatus: TripStatus): string | null {
  if (tripStatus === "ARRIVED") return "Trip completed";
  if (tripStatus === "CANCELLED") return "Trip cancelled";
  return null;
}

export interface AdminStopPresentation {
  readonly nextStop: StopEta | null;
  readonly finalStop: StopEta | null;
  readonly noRemainingStopsMessage: string | null;
}

export function adminStopPresentation(
  stopEstimates: readonly StopEta[],
  tripStatus: TripStatus,
): AdminStopPresentation {
  if (stopEstimates.length === 0) {
    return {
      nextStop: null,
      finalStop: null,
      noRemainingStopsMessage:
        tripStatus === "BOARDING" || tripStatus === "DEPARTED"
          ? "At final stop · awaiting trip completion"
          : "No remaining stop ETA",
    };
  }

  return {
    nextStop: stopEstimates[0],
    finalStop: stopEstimates[stopEstimates.length - 1],
    noRemainingStopsMessage: null,
  };
}
