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
    <div className="tracking-view animate-fade-in">
      <header className="tracking-header">
        <p className="eyebrow">Simulated GPS / Prototype</p>
        <h2 className="section-title">Shuttle tracking</h2>
        <p className="section-subtitle">Persisted simulated telemetry updates for the selected Trip.</p>
      </header>

      <div className="tracking-selector">
        <Navigation aria-hidden />
        <label htmlFor="tracking-trip">
          <span>Select Trip to Track</span>
          <small>Choose an upcoming or active Trip.</small>
        </label>
        <select
          id="tracking-trip"
          value={trackedTrip?.id || ""}
          onChange={(e) => {
            const t = trips.find((x) => x.id === e.target.value);
            setTrackedTrip(t || null);
          }}
          className="input-field"
        >
          <option value="">-- Select a trip --</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.routeName} ({t.busPlateNumber}) ·{" "}
              {new Date(t.departureTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </option>
          ))}
        </select>
      </div>

      {trackedTrip ? (
        <div className="tracking-workspace">
          <div className="tracking-map-region">
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

          <aside className="tracking-detail">
            <h3>Trip Details</h3>

            <dl className="tracking-detail-list">
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
                  label: "Planned arrival",
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
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <section className="tracking-route-stops">
              <h4>Route Stops</h4>
              <ol>
                {(trackedTrip.routeStops || []).map(
                  (stop: string, i: number, arr: string[]) => (
                    <li key={`${stop}-${i}`} className={i === 0 ? "is-origin" : i === arr.length - 1 ? "is-destination" : ""}>
                      <i aria-hidden />
                      <span>{stop}</span>
                    </li>
                  )
                )}
                {(trackedTrip.routeStops || []).length === 0 && (
                  <li className="is-empty">
                    No snapshotted route stops are available for this Trip.
                  </li>
                )}
              </ol>
            </section>

            {trackedTrip.status === "NOT_STARTED" && (
              <button
                onClick={onBrowseTrips}
                disabled={
                  (user?.creditScore ?? productPolicy.initialCredit) <
                  productPolicy.bookingRestrictionBelowCredit
                }
                className="btn-primary tracking-book-action"
              >
                <Ticket className="w-4 h-4" />
                Choose From / To
              </button>
            )}
          </aside>
        </div>
      ) : (
        <div className="tracking-empty">
          <Navigation aria-hidden />
          <strong>Select a Trip above to track</strong>
          <p>
            Simulated telemetry updates will appear here when available.
          </p>
        </div>
      )}
    </div>
  );
}
