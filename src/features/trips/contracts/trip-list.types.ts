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
  continuityFromPrevious?: "CONTINUOUS" | "DEADHEAD_REQUIRED" | null;
  seatedCapacity?: number;
  standingCapacity?: number;
  departureTime: string;
  estimatedArrivalTime: string;
  status: "NOT_STARTED" | "BOARDING" | "DEPARTED" | "ARRIVED" | "CANCELLED";
  delayMinutes?: number;
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
  }>;
  routeStops?: string[];
}
