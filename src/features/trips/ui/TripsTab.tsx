"use client";

import { CalendarClock, Plus, XCircle } from "lucide-react";
import { formatMytDate, formatMytTime } from "@/shared/time/operational-time";

export default function TripsTab({
  isDriverPortal = false,
  trips,
  onOpenModal,
  onOpenBulk,
  onCreateBlock,
  onEditTrip,
  onCancelTrip,
}: {
  isDriverPortal?: boolean;
  trips: any[];
  onOpenModal?: (() => void) | null;
  onOpenBulk?: (() => void) | null;
  onCreateBlock?: (() => void) | null;
  onEditTrip?: ((trip: any) => void) | null;
  onCancelTrip?: ((trip: any) => void) | null;
}) {
  const grouped = trips.reduce<Record<string, any[]>>((result, trip) => {
    const key = formatMytDate(trip.departureTime, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    (result[key] ||= []).push(trip);
    return result;
  }, {});
  return (
    <div className="management-view timetable-view animate-fade-in">
      <header className="management-header">
        <div>
          <p className="eyebrow">Scheduling</p>
          <h1 className="section-title">Timetable</h1>
          <p className="section-subtitle">
            {trips.length} scheduled Trips with route snapshots and assignments.
          </p>
        </div>
        {!isDriverPortal && (
          <div className="row-actions">
            {onCreateBlock && (
              <button onClick={onCreateBlock} className="btn-secondary">
                <Plus aria-hidden className="size-4" /> Create ServiceBlock
              </button>
            )}
            {onOpenModal && (
              <button onClick={onOpenModal} className="btn-primary">
                <Plus aria-hidden className="size-4" /> Schedule Trip
              </button>
            )}
            {onOpenBulk && (
              <button onClick={onOpenBulk} className="btn-secondary">
                <CalendarClock aria-hidden className="size-4" /> Generate timetable
              </button>
            )}
          </div>
        )}
      </header>
      <div className="timetable-days">
        {Object.entries(grouped).map(([date, dateTrips]) => (
          <section key={date}>
            <h2>{date}</h2>
            <div>
              {dateTrips
                .sort(
                  (a, b) =>
                    new Date(a.departureTime).getTime() -
                    new Date(b.departureTime).getTime(),
                )
                .map((trip) => (
                  <article key={trip.id}>
                    <time>
                      {formatMytTime(trip.departureTime)}
                    </time>
                    <div className="timetable-route">
                      <strong>{trip.routeName}</strong>
                      <span>
                        {trip.busPlateNumber} {!isDriverPortal && "· "}
                        {!isDriverPortal &&
                          (trip.driverName || "Unassigned driver")}
                      </span>
                      {trip.blockCode && (
                        <>
                          <small>
                            {trip.blockCode} · Seq {trip.blockSequence}
                            {trip.continuityFromPrevious?.status !== "CONTINUOUS_OK"
                              ? ` · ${trip.continuityFromPrevious?.status.replaceAll("_", " ")}`
                              : ""}
                          </small>
                          {trip.continuityFromPrevious?.status !== "CONTINUOUS_OK" && trip.continuityFromPrevious?.message && <small className="text-amber-400">{trip.continuityFromPrevious.message}</small>}
                        </>
                      )}
                    </div>
                    <div className="timetable-load">
                      <span>
                        {trip.seatedCapacity} seated + {trip.standingCapacity}{" "}
                        standing
                      </span>
                      <small>
                        Reserved {trip.stats?.confirmedReserved ?? 0} · Boarded{" "}
                        {trip.stats?.boardedReserved ?? 0} · Waiting{" "}
                        {trip.stats?.waitlistWaiting ?? 0}
                      </small>
                    </div>
                    <span
                      className={`badge ${trip.status === "CANCELLED" ? "badge-red" : trip.status === "ARRIVED" ? "badge-green" : "badge-blue"}`}
                    >
                      {trip.status}
                      {trip.delayMinutes ? ` · expected +${trip.delayMinutes} min` : ""}
                    </span>
                    <div className="row-actions">
                      {trip.status === "NOT_STARTED" && !isDriverPortal && onEditTrip && (
                        <button
                          onClick={() => onEditTrip(trip)}
                          className="btn-ghost"
                        >
                          <CalendarClock aria-hidden className="size-3.5" />{" "}
                          Reschedule
                        </button>
                      )}
                      {!["ARRIVED", "CANCELLED"].includes(trip.status) &&
                        !isDriverPortal &&
                        onCancelTrip && (
                          <button
                            onClick={() => onCancelTrip(trip)}
                            className="btn-ghost danger"
                          >
                            <XCircle aria-hidden className="size-3.5" /> Cancel
                          </button>
                        )}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
