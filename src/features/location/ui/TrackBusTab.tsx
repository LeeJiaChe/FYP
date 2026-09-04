"use client";

import { productPolicy } from "@/shared/config/policies";

import { Navigation, Ticket } from "lucide-react";
import BusLocationTracker from "./BusLocationTracker";
import { resolveStudentTrackingState } from "@/features/trips/public";
import { formatMytTime } from "@/shared/time/operational-time";
import { useOperationalClock } from "@/shared/ui/useOperationalClock";

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
  const nowMs = useOperationalClock();
  const trackableTrips = trips.filter(
    (trip) =>
      resolveStudentTrackingState(
        trip.status,
        new Date(trip.departureTime),
        new Date(nowMs),
      ) !== "UNAVAILABLE",
  );
  const selectedTrip = trackableTrips.find((trip) => trip.id === trackedTrip?.id) ?? null;
  const selectedTrackingState = selectedTrip
    ? resolveStudentTrackingState(
        selectedTrip.status,
        new Date(selectedTrip.departureTime),
        new Date(nowMs),
      )
    : "UNAVAILABLE";
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
          value={selectedTrip?.id || ""}
          onChange={(e) => {
            const t = trackableTrips.find((x) => x.id === e.target.value);
            setTrackedTrip(t || null);
          }}
          className="input-field"
        >
          <option value="">-- Select a trip --</option>
          {trackableTrips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.routeName} ({t.busPlateNumber}) ·{" "}
              {formatMytTime(t.departureTime)} MYT · {resolveStudentTrackingState(t.status, new Date(t.departureTime), new Date(nowMs)) === "AWAITING_OPERATION" ? "Awaiting operation" : t.status === "NOT_STARTED" ? "Upcoming" : "Live"}
            </option>
          ))}
        </select>
      </div>

      {selectedTrip ? (
        <div className="tracking-workspace">
          <div className="tracking-map-region">
            <BusLocationTracker
              tripId={selectedTrip.id}
              routeName={selectedTrip.routeName}
              stops={selectedTrip.routeStops || []}
              tripStops={selectedTrip.tripStops || []}
              departureTime={selectedTrip.departureTime}
              estimatedArrivalTime={selectedTrip.estimatedArrivalTime}
              busPlateNumber={selectedTrip.busPlateNumber}
              status={selectedTrip.status}
            />
          </div>

          <aside className="tracking-detail">
            <h3>Trip Details</h3>

            <dl className="tracking-detail-list">
              {[
                { label: "Route", value: selectedTrip.routeName },
                { label: "Bus Plate", value: selectedTrip.busPlateNumber },
                {
                  label: "Status",
                  value:
                    selectedTrackingState === "AWAITING_OPERATION"
                      ? "Scheduled departure passed · operation not started"
                      : selectedTrip.status.replaceAll("_", " "),
                },
                {
                  label: "Departure",
                  value: `${formatMytTime(selectedTrip.departureTime)} MYT`,
                },
                {
                  label: "Planned arrival",
                  value: `${formatMytTime(selectedTrip.estimatedArrivalTime)} MYT`,
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

            {selectedTrackingState === "AWAITING_OPERATION" && (
              <section className="tracking-operational-note" role="status">
                <strong>Awaiting operational start</strong>
                <p>
                  The scheduled departure has passed, but the Trip has not been
                  marked boarding or departed. Live position may not be available yet.
                  {selectedTrip.expectedDelayMinutes
                    ? ` Reported expected delay: ${selectedTrip.expectedDelayMinutes} minutes.`
                    : " No expected delay has been reported."}
                </p>
              </section>
            )}

            <section className="tracking-route-stops">
              <h4>Route Stops</h4>
              <ol>
                {(selectedTrip.routeStops || []).map(
                  (stop: string, i: number, arr: string[]) => (
                    <li key={`${stop}-${i}`} className={i === 0 ? "is-origin" : i === arr.length - 1 ? "is-destination" : ""}>
                      <i aria-hidden />
                      <span>{stop}</span>
                    </li>
                  )
                )}
                {(selectedTrip.routeStops || []).length === 0 && (
                  <li className="is-empty">
                    No snapshotted route stops are available for this Trip.
                  </li>
                )}
              </ol>
            </section>

            {selectedTrip.status === "NOT_STARTED" && (
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
          <strong>{trackableTrips.length ? "Select a Trip above to track" : "No live or upcoming Trips"}</strong>
          <p>
            {trackableTrips.length ? "Upcoming Trips show schedule context; live telemetry appears after operations begin." : "Cancelled and completed Trips remain in journey history, not the live tracker."}
          </p>
        </div>
      )}
    </div>
  );
}
