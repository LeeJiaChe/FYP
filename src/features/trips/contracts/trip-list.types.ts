import type { CurrentUser } from "@/shared/ui/current-user";

export interface TripListItem {
  id: string;
  routeId: string;
  busId: string;
  driverId?: string | null;
  routeName?: string;
  lineId?: string;
  lineCode?: string;
  lineName?: string;
  direction?: "OUTBOUND" | "INBOUND";
  busPlateNumber?: string;
  driverName?: string;
  blockId?: string | null;
  blockCode?: string | null;
  blockSequence?: number | null;
  continuityFromPrevious?: {
    status:
      | "CONTINUOUS_OK"
      | "TURNAROUND_TOO_SHORT"
      | "DEADHEAD_REQUIRED"
      | "DEADHEAD_TIME_INSUFFICIENT";
    gapMinutes: number;
    minimumTurnaroundMinutes: number;
    message: string;
  } | null;
  busTransitionFromPrevious?: {
    status:
      | "CONTINUOUS_OK"
      | "TURNAROUND_TOO_SHORT"
      | "DEADHEAD_REQUIRED"
      | "DEADHEAD_TIME_INSUFFICIENT";
    gapMinutes: number;
    minimumTurnaroundMinutes: number;
    message: string;
  } | null;
  seatedCapacity?: number;
  standingCapacity?: number;
  departureTime: string;
  estimatedArrivalTime: string;
  status: "NOT_STARTED" | "BOARDING" | "DEPARTED" | "ARRIVED" | "CANCELLED";
  delayMinutes?: number;
  expectedDelayMinutes?: number;
  expectedDelayReason?: string | null;
  trackingState?: "UPCOMING" | "AWAITING_OPERATION" | "LIVE" | "UNAVAILABLE";
  createdAt: string;
  route?: { id: string; name: string; stops: string[]; createdAt: string };
  bus?: {
    id: string;
    plateNumber: string;
    seatedCapacity: number;
    standingCapacity: number;
    status: "ACTIVE" | "MAINTENANCE" | "RETIRED";
    createdAt: string;
  };
  driver?: CurrentUser;
  stats?: {
    totalSeats: number;
    confirmedReserved?: number;
    boardedReserved?: number;
    noShow?: number;
    walkInBoarded?: number;
    waitlistWaiting?: number;
  };
  tripStops?: Array<{
    id: string;
    stopId: string;
    position: number;
    stopCode: string;
    stopName: string;
    plannedArrival: string;
    plannedDeparture: string;
    boardingDeadline: string;
    actualArrival?: string | null;
    actualDeparture?: string | null;
    passedAt?: string | null;
    bookingEligibility?: {
      canReserve: boolean;
      canJoinWaitlist: boolean;
      canCreateWalkInIntent: boolean;
      reason:
        | "AVAILABLE"
        | "BOOKING_NOT_OPEN"
        | "BOOKING_CLOSED"
        | "TRIP_CANCELLED"
        | "TRIP_COMPLETED"
        | "CREDIT_RESTRICTED"
        | "FULL";
      opensAt?: string;
    };
  }>;
  routeStops?: string[];
}
