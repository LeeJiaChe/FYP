"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import io from "socket.io-client";
import { AlertCircle, Bus, Clock, MapPin, Navigation, RefreshCw } from "lucide-react";

interface TelemetryLocation {
  tripId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  source: "SIMULATED" | "GPS";
  ageMs: number;
}

interface TripStopCoordinate {
  name?: string;
  stopName?: string;
  latitude: number;
  longitude: number;
}

interface BusLocationProps {
  tripId: string;
  routeName: string;
  stops: string[];
  tripStops?: TripStopCoordinate[];
  departureTime: string;
  estimatedArrivalTime: string;
  busPlateNumber: string;
  status: string;
}

function ageLabel(recordedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(recordedAt).getTime()) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)} min ago`;
}

export default function BusLocationTracker({
  tripId,
  routeName,
  stops,
  tripStops = [],
  busPlateNumber,
  status,
}: BusLocationProps) {
  const [location, setLocation] = useState<TelemetryLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);

  const fetchLatest = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/location`, { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json();
      setLocation(body.location ?? null);
      setNow(Date.now());
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void fetchLatest();
    const refreshTimer = window.setInterval(() => void fetchLatest(), 15_000);
    const ageTimer = window.setInterval(() => setNow(Date.now()), 5_000);
    let socket: ReturnType<typeof io> | null = null;
    let disposed = false;
    void fetch("/api/realtime/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    }).then(async (response) => {
      if (!response.ok || disposed) return;
      const subscription = await response.json();
      if (disposed) return;
      socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000", {
        auth: { token: subscription.token },
      });
      socket.on("connect", fetchLatest);
      socket.on("location.changed", fetchLatest);
      socket.on("trip.changed", fetchLatest);
    });
    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
      window.clearInterval(ageTimer);
      socket?.disconnect();
    };
  }, [fetchLatest, tripId]);

  const marker = useMemo(() => {
    if (!location || tripStops.length < 2) return { left: 50, top: 50 };
    const latitudes = tripStops.map((stop) => Number(stop.latitude));
    const longitudes = tripStops.map((stop) => Number(stop.longitude));
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latRange = Math.max(0.000001, maxLat - minLat);
    const lngRange = Math.max(0.000001, maxLng - minLng);
    return {
      left: 8 + Math.max(0, Math.min(1, (location.longitude - minLng) / lngRange)) * 84,
      top: 8 + (1 - Math.max(0, Math.min(1, (location.latitude - minLat) / latRange))) * 84,
    };
  }, [location, tripStops]);

  const stale = location ? now - new Date(location.recordedAt).getTime() > 30_000 : false;
  const statusColor = status === "ARRIVED" ? "#4ade80" : "var(--accent-secondary)";

  return (
    <div className="rounded-2xl p-5 space-y-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))" }}>
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Live Bus Location</h3>
          </div>
          <p className="text-[10px] font-bold" style={{ color: "var(--accent-secondary)" }}>
            Simulated GPS / Prototype
          </p>
        </div>
        <button type="button" onClick={() => void fetchLatest()} className="btn-ghost p-2" aria-label="Refresh telemetry">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative h-64 overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(30,41,59,.95), rgba(15,23,42,.95))", border: "1px solid var(--border)" }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(148,163,184,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.25) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        {tripStops.map((stop, index) => {
          const latitudes = tripStops.map((item) => Number(item.latitude));
          const longitudes = tripStops.map((item) => Number(item.longitude));
          const latRange = Math.max(0.000001, Math.max(...latitudes) - Math.min(...latitudes));
          const lngRange = Math.max(0.000001, Math.max(...longitudes) - Math.min(...longitudes));
          const left = 8 + ((Number(stop.longitude) - Math.min(...longitudes)) / lngRange) * 84;
          const top = 8 + (1 - (Number(stop.latitude) - Math.min(...latitudes)) / latRange) * 84;
          return <MapPin key={`${stop.stopName ?? stop.name}-${index}`} className="absolute w-4 h-4 text-slate-400" style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }} />;
        })}
        {location ? (
          <div className="absolute transition-all duration-700" style={{ left: `${marker.left}%`, top: `${marker.top}%`, transform: "translate(-50%, -50%)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", border: "3px solid white", boxShadow: "0 0 0 5px rgba(59,130,246,.2)" }}>
              <Bus className="w-5 h-5 text-white" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center p-6">
            <div>
              <AlertCircle className="w-7 h-7 mx-auto mb-2 text-amber-400" />
              <p className="text-sm font-bold text-slate-200">{loading ? "Loading telemetry…" : "No live telemetry received yet."}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl" style={{ background: "var(--bg-surface)" }}><span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>Route</span><strong>{routeName}</strong></div>
        <div className="p-3 rounded-xl" style={{ background: "var(--bg-surface)" }}><span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>Bus / Status</span><strong style={{ color: statusColor }}>{busPlateNumber} · {status.replaceAll("_", " ")}</strong></div>
        <div className="p-3 rounded-xl" style={{ background: "var(--bg-surface)" }}><span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>Latest sample</span><strong className={stale ? "text-amber-400" : "text-emerald-400"}>{location ? ageLabel(location.recordedAt, now) : "Unavailable"}</strong></div>
      </div>

      {location && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Recorded {new Date(location.recordedAt).toLocaleString()}</span>
          <span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} · {location.source}</span>
        </div>
      )}
      {!location && stops.length > 0 && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Route stops: {stops.join(" → ")}</p>}
    </div>
  );
}
