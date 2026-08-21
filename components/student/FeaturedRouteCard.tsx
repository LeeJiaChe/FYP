"use client";

import { Bus, ChevronRight, Navigation } from "lucide-react";

interface FeaturedRouteCardProps {
  trips: Array<{
    departureTime: string;
    routeName?: string;
    routeStops?: string[];
    status?: string;
  }>;
  onBrowseRoutes: () => void;
}

export default function FeaturedRouteCard({
  trips,
  onBrowseRoutes,
}: FeaturedRouteCardProps) {
  const featuredTrip = [...trips]
    .filter((trip) => trip.status === "NOT_STARTED")
    .sort(
      (left, right) =>
        new Date(left.departureTime).getTime() -
        new Date(right.departureTime).getTime(),
    )[0];
  const stops = featuredTrip?.routeStops ?? [];

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-5 animate-slide-up"
      style={{
        background:
          "linear-gradient(135deg, var(--accent-primary)22, var(--accent-secondary)11)",
        border: "1px solid var(--border-hover)",
      }}
      aria-labelledby="featured-route-title"
    >
      <div className="absolute top-0 right-0 w-40 h-40 opacity-5 float-animation pointer-events-none">
        <Bus className="w-full h-full" />
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--accent-primary)" }}
          >
            Next prototype service
          </p>
          <h2
            id="featured-route-title"
            className="text-xl font-extrabold"
            style={{ color: "var(--text-primary)" }}
          >
            {featuredTrip?.routeName ?? "Browse available shuttle routes"}
          </h2>
          {stops.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 items-center">
              {stops.map((stop, index) => (
                <span key={`${stop}-${index}`} className="flex items-center gap-1">
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
                  {index < stops.length - 1 && (
                    <ChevronRight
                      className="w-3 h-3"
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              No upcoming Trips are available yet.
            </p>
          )}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
          {featuredTrip && (
            <div className="sm:text-right">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Next departure
              </p>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                {new Date(featuredTrip.departureTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
          <button
            onClick={onBrowseRoutes}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" />
            Browse journeys
          </button>
        </div>
      </div>
    </section>
  );
}
