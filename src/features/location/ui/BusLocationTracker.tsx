"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import io from "socket.io-client";
import { Bus, Clock, MapPin, Navigation, RefreshCw } from "lucide-react";
import { formatMytDateTime } from "@/shared/time/operational-time";
import GoogleTelemetryMap from "./GoogleTelemetryMap";

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
  const [browserMapFailed, setBrowserMapFailed] = useState(false);
  const browserMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
  const handleBrowserMapUnavailable = useCallback(() => setBrowserMapFailed(true), []);
  const geographicStops = useMemo(
    () =>
      tripStops.map((stop) => ({
        name: stop.stopName ?? stop.name ?? "Route stop",
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
      })),
    [tripStops],
  );

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
  return (
    <section className="telemetry-panel">
      <header className="telemetry-heading">
        <div>
          <div className="telemetry-title">
            <span><Navigation aria-hidden /></span>
            <h3>Shuttle position</h3>
          </div>
          <p>
            Simulated GPS / Prototype
          </p>
        </div>
        <button type="button" onClick={() => void fetchLatest()} className="btn-ghost telemetry-refresh" aria-label="Refresh telemetry">
          <RefreshCw aria-hidden />
        </button>
      </header>

      {location ? (
        <>
          {browserMapsKey && !browserMapFailed ? (
            <GoogleTelemetryMap
              apiKey={browserMapsKey}
              location={location}
              stops={geographicStops}
              busPlateNumber={busPlateNumber}
              onUnavailable={handleBrowserMapUnavailable}
            />
          ) : (
            <div className="telemetry-map" aria-label="Fallback route coordinate schematic">
              <div className="telemetry-map-texture" aria-hidden />
              {tripStops.map((stop, index) => {
                const latitudes = tripStops.map((item) => Number(item.latitude));
                const longitudes = tripStops.map((item) => Number(item.longitude));
                const latRange = Math.max(0.000001, Math.max(...latitudes) - Math.min(...latitudes));
                const lngRange = Math.max(0.000001, Math.max(...longitudes) - Math.min(...longitudes));
                const left = 8 + ((Number(stop.longitude) - Math.min(...longitudes)) / lngRange) * 84;
                const top = 8 + (1 - (Number(stop.latitude) - Math.min(...latitudes)) / latRange) * 84;
                return <MapPin key={`${stop.stopName ?? stop.name}-${index}`} className="telemetry-stop-marker" style={{ left: `${left}%`, top: `${top}%` }} aria-hidden />;
              })}
              <div className="telemetry-bus-marker" style={{ left: `${marker.left}%`, top: `${marker.top}%` }}>
                <Bus aria-hidden />
              </div>
            </div>
          )}
          <p className="text-[11px] text-[var(--text-muted)]">
            {browserMapsKey && !browserMapFailed ? "Google geographic map · stop-sequence overlay" : "Coordinate schematic fallback"} · Simulated GPS / Prototype
          </p>

          <dl className="telemetry-facts">
            <div><dt>Route</dt><dd>{routeName}</dd></div>
            <div><dt>Bus / Status</dt><dd className={status === "ARRIVED" ? "is-arrived" : ""}>{busPlateNumber} · {status.replaceAll("_", " ")}</dd></div>
            <div><dt>Latest sample</dt><dd className={stale ? "is-stale" : "is-current"}>{ageLabel(location.recordedAt, now)}</dd></div>
          </dl>

          <footer className="telemetry-meta">
            <span><Clock aria-hidden /> Recorded {formatMytDateTime(location.recordedAt)} MYT</span>
            <span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} · {location.source}</span>
          </footer>
        </>
      ) : (
        <section className={`telemetry-unavailable ${loading ? "is-loading" : ""}`} aria-live="polite">
          <header>
            <span className="telemetry-unavailable-icon"><Navigation aria-hidden /></span>
            <div>
              <strong>{loading ? "Checking latest position" : "Live position unavailable"}</strong>
              <p>{loading ? "Looking for a persisted simulated GPS sample." : "No persisted simulated GPS sample is available for this Trip."}</p>
            </div>
          </header>

          <dl className="telemetry-unavailable-facts">
            <div><dt>Current route</dt><dd>{routeName}</dd></div>
            <div><dt>Operational state</dt><dd className={status === "ARRIVED" ? "is-arrived" : ""}>{status.replaceAll("_", " ")}</dd></div>
            <div><dt>Latest authoritative stop</dt><dd>{status === "ARRIVED" && stops.length > 0 ? stops[stops.length - 1] : "Not available"}</dd></div>
          </dl>

          <div className="telemetry-unavailable-route">
            <div><strong>Stop progression</strong><span>Scheduled route order</span></div>
            {stops.length > 0 ? (
              <ol>
                {stops.map((stop, index) => (
                  <li key={`${stop}-${index}`} className={status === "ARRIVED" && index === stops.length - 1 ? "is-arrived" : ""}>
                    <i aria-hidden />
                    <span>{stop}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No snapshotted route stops are available for this Trip.</p>
            )}
          </div>

          <small>Position will appear when a persisted simulated sample becomes available.</small>
        </section>
      )}
    </section>
  );
}
