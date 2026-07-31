"use client";

import { Bus, ChevronRight, Navigation } from "lucide-react";

const ROUTE_36_STOPS = [
  "Main Gate",
  "Block 3",
  "Block 4",
  "Block 5",
  "Block 6 Terminal",
];

interface Route36HighlightCardProps {
  trips: any[];
  onSelectRoute: () => void;
}

export default function Route36HighlightCard({
  trips,
  onSelectRoute,
}: Route36HighlightCardProps) {
  const nextDepartureTrip = trips.find(
    (t) =>
      t.routeStops?.includes("Block 3") || t.routeStops?.includes("Block 6")
  );

  const nextDepartureTimeStr = nextDepartureTrip
    ? new Date(nextDepartureTrip.departureTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "View Schedule";

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 animate-slide-up"
      style={{
        background:
          "linear-gradient(135deg, var(--accent-primary)22, var(--accent-secondary)11)",
        border: "1px solid var(--border-hover)",
      }}
    >
      <div className="absolute top-0 right-0 w-40 h-40 opacity-5 float-animation pointer-events-none">
        <Bus className="w-full h-full" />
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className="live-dot w-2.5 h-2.5 rounded-full"
              style={{ background: "#4ade80", display: "inline-block" }}
            />
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "#4ade80" }}
            >
              Live Route
            </span>
          </div>
          <h2
            className="text-xl font-extrabold"
            style={{ color: "var(--text-primary)" }}
          >
            Internal Ring Shuttle
          </h2>
          <div className="flex flex-wrap gap-1.5 items-center">
            {ROUTE_36_STOPS.map((stop, i) => (
              <span key={i} className="flex items-center gap-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-md font-semibold"
                  style={{
                    background: "var(--accent-glow)",
                    color: "var(--accent-secondary)",
                    border: "1px solid var(--border-hover)",
                  }}
                >
                  {stop}
                </span>
                {i < ROUTE_36_STOPS.length - 1 && (
                  <ChevronRight
                    className="w-3 h-3"
                    style={{ color: "var(--text-muted)" }}
                  />
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Next Departure
            </p>
            <p
              className="font-bold text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              {nextDepartureTimeStr}
            </p>
          </div>
          <button
            onClick={onSelectRoute}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" />
            Book This Route
          </button>
        </div>
      </div>
    </div>
  );
}
