import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { TripListItem } from "@/features/trips/contracts/trip-list.types";

export function useTrips(routeId?: string, driverId?: string) {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const fetchTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      let url = "/api/trips?";
      if (routeId) url += `routeId=${routeId}&`;
      if (driverId) url += `driverId=${driverId}&`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to fetch trips");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Network error fetching trips");
    } finally {
      setLoadingTrips(false);
    }
  }, [routeId, driverId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchTrips(), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchTrips]);

  return { trips, loadingTrips, fetchTrips, setTrips };
}
