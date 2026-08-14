export interface User {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "DRIVER" | "ADMIN";
  studentId?: string | null;
  creditScore?: number;
  isBookingRestricted?: boolean;
}

export interface Bus {
  id: string;
  plateNumber: string;
  seatedCapacity: number;
  standingCapacity: number;
  status: "ACTIVE" | "MAINTENANCE" | "RETIRED";
  createdAt: string;
}

export interface Route {
  id: string;
  name: string;
  stops: string[];
  createdAt: string;
}

export interface Trip {
  id: string;
  routeId: string;
  busId: string;
  driverId: string;
  departureTime: string;
  estimatedArrivalTime: string;
  status: "NOT_STARTED" | "BOARDING" | "DEPARTED" | "ARRIVED" | "CANCELLED";
  delayMinutes?: number;
  createdAt: string;
  
  // Relations
  route?: Route;
  bus?: Bus;
  driver?: User;
  
  // Stats added by API
  stats?: {
    totalSeats: number;
    legacyAvailableSeats?: number;
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
  
  // For frontend use sometimes
  routeName?: string;
  busPlateNumber?: string;
  routeStops?: string[];
}

export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  createdAt: string;
  
  // Relations
  trip?: Trip;
  user?: User;
}

export interface Penalty {
  id: string;
  userId: string;
  tripId: string | null;
  reason: string;
  pointsDeducted: number;
  status: "ACTIVE" | "APPEALED" | "RESOLVED";
  createdAt: string;
  
  // Relations
  trip?: Trip;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
