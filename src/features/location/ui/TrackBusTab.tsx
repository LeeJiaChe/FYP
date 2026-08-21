"use client";

import { productPolicy } from "@/shared/config/policies";

import { Navigation, Ticket } from "lucide-react";
import BusLocationTracker from "./BusLocationTracker";

interface TrackBusTabProps {
  trips: any[];
  trackedTrip: any;
  setTrackedTrip: (trip: any) => void;
  user?: any;
  onBrowseTrips: () => void;
}

export default function TrackBusTab({
  trips,
  trackedTrip,
  setTrackedTrip,
  user,
  onBrowseTrips,
}: TrackBusTabProps) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="section-title text-xl">Real-Time Bus Tracker</h2>
        <p className="section-subtitle">Persisted simulated GPS telemetry for your bus</p>
      </div>

      <div
        className="flex flex-wrap items-center gap-3 p-4 rounded-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <Navigation
          className="w-4 h-4 shrink-0"
          style={{ color: "var(--accent-secondary)" }}
        />
        <label
          htmlFor="tracking-trip"
          className="text-xs font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Select Trip to Track:
        </label>
        <select
          id="tracking-trip"
          value={trackedTrip?.id || ""}
          onChange={(e) => {
            const t = trips.find((x) => x.id === e.target.value);
            setTrackedTrip(t || null);
          }}
          className="input-field py-1.5 text-xs"
          style={{ maxWidth: "300px" }}
        >
          <option value="">-- Select a trip --</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.routeName} ({t.busPlateNumber}) —{" "}
              {new Date(t.departureTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </option>
          ))}
        </select>
      </div>

      {trackedTrip ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <BusLocationTracker
              tripId={trackedTrip.id}
              routeName={trackedTrip.routeName}
              stops={trackedTrip.routeStops || []}
              tripStops={trackedTrip.tripStops || []}
              departureTime={trackedTrip.departureTime}
              estimatedArrivalTime={trackedTrip.estimatedArrivalTime}
              busPlateNumber={trackedTrip.busPlateNumber}
              status={trackedTrip.status}
            />
          </div>

          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <h3
              className="font-bold text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              Trip Details
            </h3>

            <div className="space-y-3">
              {[
                { label: "Route", value: trackedTrip.routeName },
                { label: "Bus Plate", value: trackedTrip.busPlateNumber },
                {
                  label: "Status",
                  value: trackedTrip.status.replace("_", " "),
                },
                {
                  label: "Departure",
                  value: new Date(trackedTrip.departureTime).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" }
                  ),
                },
                {
                  label: "Est. Arrival",
                  value: new Date(
                    trackedTrip.estimatedArrivalTime
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
                {
                  label: "Available Seats",
                  value: "Select From / To to check",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span
                    className="font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="pt-3 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <p
                className="text-xs font-bold mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Route Stops
              </p>
              <div className="space-y-2">
                {(trackedTrip.routeStops || []).map(
                  (stop: string, i: number, arr: string[]) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            background:
                              i === 0
                                ? "#4ade80"
                                : i === arr.length - 1
                                  ? "var(--accent-primary)"
                                  : "var(--border)",
                            border: "2px solid var(--bg-card)",
                            boxShadow:
                              i === 0 || i === arr.length - 1
                                ? "0 0 8px var(--accent-glow)"
                                : "none",
                          }}
                        />
                        {i < arr.length - 1 && (
                          <div
                            className="w-0.5 h-4 mt-1"
                            style={{ background: "var(--border)" }}
                          />
                        )}
                      </div>
                      <span
                        className="text-xs"
                        style={{
                          color:
                            i === 0
                              ? "#4ade80"
                              : i === arr.length - 1
                                ? "var(--accent-secondary)"
                                : "var(--text-muted)",
                          fontWeight:
                            i === 0 || i === arr.length - 1 ? "700" : "400",
                        }}
                      >
                        {stop}
                      </span>
                    </div>
                  )
                )}
                {(trackedTrip.routeStops || []).length === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No snapshotted route stops are available for this Trip.
                  </p>
                )}
              </div>
            </div>

            {trackedTrip.status === "NOT_STARTED" && (
              <button
                onClick={onBrowseTrips}
                disabled={
                  (user?.creditScore ?? productPolicy.initialCredit) <
                  productPolicy.bookingRestrictionBelowCredit
                }
                className="btn-primary w-full text-xs flex items-center justify-center gap-2 mt-2"
              >
                <Ticket className="w-4 h-4" />
                Choose From / To
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="py-16 text-center rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <Navigation
            className="w-10 h-10 mx-auto mb-3 float-animation"
            style={{ color: "var(--text-muted)" }}
          />
          <p
            className="font-bold"
            style={{ color: "var(--text-secondary)" }}
          >
            Select a trip above to track
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Real-time bus position and ETA will appear here
          </p>
        </div>
      )}
    </div>
  );
}
