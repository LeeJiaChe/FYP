import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Trip } from "@/types";

export function useTrips(routeId?: string, driverId?: string) {
  const [trips, setTrips] = useState<Trip[]>([]);
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
    } catch (err: any) {
      toast.error(err.message || "Network error fetching trips");
    } finally {
      setLoadingTrips(false);
    }
  }, [routeId, driverId]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  return { trips, loadingTrips, fetchTrips, setTrips };
}
