"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bus, CalendarDays, Clock, MapPin, RefreshCw, Ticket } from "lucide-react";
import ConnectedRouteLine from "./ConnectedRouteLine";
import { formatMytDate, formatMytTime, toMytServiceDateKey } from "@/shared/time/operational-time";
import { useOperationalClock } from "@/shared/ui/useOperationalClock";

interface TripsTabProps {
  routes: any[];
  trips: any[];
  isBookingRestricted?: boolean;
  onRefresh: () => void;
  onOpenSeatModal: (tripId: string, boardingTripStopId: string, dropOffTripStopId: string) => void;
  onTrackTrip: (trip: any) => void;
}

function dateKey(value: string | Date) {
  return toMytServiceDateKey(value);
}

function readableDate(value: string) {
  return formatMytDate(`${value}T00:00:00+08:00`);
}

function eligibilityMessage(reason?: string, opensAt?: string) {
  if (reason === "BOOKING_NOT_OPEN") return opensAt ? `Booking opens ${formatMytDate(opensAt)} at ${formatMytTime(opensAt)} MYT.` : "Booking has not opened yet.";
  if (reason === "BOOKING_CLOSED") return "Booking closed when boarding began at this stop.";
  if (reason === "TRIP_CANCELLED") return "This Trip was cancelled.";
  if (reason === "TRIP_COMPLETED") return "This Trip has completed.";
  if (reason === "CREDIT_RESTRICTED") return "Reservation is restricted by your passenger credit standing.";
  return "Seat availability can be checked for this journey.";
}

export default function TripsTab({
  routes,
  trips,
  isBookingRestricted,
  onRefresh,
  onOpenSeatModal,
}: TripsTabProps) {
  const [fromStop, setFromStop] = useState("");
  const [toStop, setToStop] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const departureSectionRef = useRef<HTMLElement>(null);
  const nowMs = useOperationalClock();
  const refreshedOpeningRef = useRef<string | null>(null);

  const allStops = useMemo(() => {
    const values = new Set<string>();
    routes.forEach((route) => route.stops?.forEach((stop: string) => values.add(stop)));
    return Array.from(values);
  }, [routes]);

  const destinationStops = useMemo(() => {
    if (!fromStop) return [];
    const values = new Set<string>();
    routes.forEach((route) => {
      const fromIndex = route.stops?.indexOf(fromStop) ?? -1;
      if (fromIndex < 0) return;
      route.stops.slice(fromIndex + 1).forEach((stop: string) => values.add(stop));
    });
    return Array.from(values);
  }, [fromStop, routes]);

  const matchingTrips = useMemo(() => {
    if (!fromStop || !toStop) return [];
    return trips.flatMap((trip) => {
      const boardingIndex = trip.tripStops?.findIndex((stop: any) => stop.stopName === fromStop) ?? -1;
      const dropOffIndex = trip.tripStops?.findIndex((stop: any) => stop.stopName === toStop) ?? -1;
      if (boardingIndex < 0 || dropOffIndex <= boardingIndex) return [];
      return [{
        ...trip,
        boardingStop: trip.tripStops[boardingIndex],
        dropOffStop: trip.tripStops[dropOffIndex],
      }];
    });
  }, [fromStop, toStop, trips]);

  const availableDates = useMemo(
    () => Array.from(new Set(matchingTrips.map((trip) => dateKey(trip.departureTime)))).sort(),
    [matchingTrips],
  );

  const departures = matchingTrips
    .filter((trip) => !travelDate || dateKey(trip.departureTime) === travelDate)
    .sort((a, b) => new Date(a.boardingStop?.plannedDeparture ?? a.departureTime).getTime() - new Date(b.boardingStop?.plannedDeparture ?? b.departureTime).getTime());

  useEffect(() => {
    const opening = departures.find(
      (trip) =>
        trip.boardingStop?.bookingEligibility?.reason === "BOOKING_NOT_OPEN" &&
        trip.boardingStop.bookingEligibility.opensAt &&
        new Date(trip.boardingStop.bookingEligibility.opensAt).getTime() <= nowMs,
    );
    if (!opening || refreshedOpeningRef.current === opening.id) return;
    refreshedOpeningRef.current = opening.id;
    onRefresh();
  }, [departures, nowMs, onRefresh]);

  const selectedRoute = routes.find((route) => {
    const fromIndex = route.stops?.indexOf(fromStop) ?? -1;
    const toIndex = route.stops?.indexOf(toStop) ?? -1;
    return fromIndex >= 0 && toIndex > fromIndex;
  });

  function chooseFrom(value: string) {
    setFromStop(value);
    setToStop("");
    setTravelDate("");
  }

  function chooseTo(value: string) {
    setToStop(value);
    setTravelDate("");
  }

  function chooseDate(value: string) {
    setTravelDate(value);
    if (!value || !window.matchMedia("(max-width: 767px)").matches) return;
    window.requestAnimationFrame(() => {
      departureSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return (
    <div className="journey-planner">
      <header className="planner-header">
        <div>
          <h1 className="section-title">Book your shuttle</h1>
          <p className="section-subtitle">Choose where you are boarding, where you are going, then select a departure.</p>
        </div>
        <button type="button" onClick={onRefresh} className="btn-ghost"><RefreshCw aria-hidden className="size-4" /> Refresh departures</button>
      </header>

      {isBookingRestricted && (
        <div className="planner-restriction" role="alert">Reservations are currently restricted by your passenger credit standing. You can still review scheduled departures.</div>
      )}

      <div className="planner-workspace">
        <div className="planner-route-rail" aria-hidden="true">
          <span className={fromStop ? "selected" : ""}>{fromStop || "From"}</span>
          <i className={fromStop && toStop ? "selected" : ""} />
          <span className={toStop ? "selected" : ""}>{toStop || "To"}</span>
          <i className={toStop && travelDate ? "selected" : ""} />
          <span className={travelDate ? "selected" : ""}>{travelDate ? readableDate(travelDate) : "Date"}</span>
        </div>
        <div className="planner-canvas-grid">
        <div className="planner-primary-flow">
        <section className="planner-decisions" aria-label="Journey details">
          <div className={`planner-step ${fromStop ? "completed" : "active"}`}>
            <span className="step-number">1</span>
            <label htmlFor="planner-from"><span>From</span><strong>Where will you board?</strong></label>
            <select id="planner-from" className="input-field" value={fromStop} onChange={(event) => chooseFrom(event.target.value)}>
              <option value="">Select boarding stop</option>
              {allStops.map((stop) => <option key={stop}>{stop}</option>)}
            </select>
          </div>

          <div className={`planner-step ${toStop ? "completed" : fromStop ? "active" : "locked"}`}>
            <span className="step-number">2</span>
            <label htmlFor="planner-to"><span>To</span><strong>Where are you going?</strong></label>
            <select id="planner-to" className="input-field" value={toStop} disabled={!fromStop} onChange={(event) => chooseTo(event.target.value)}>
              <option value="">Select destination</option>
              {destinationStops.map((stop) => <option key={stop}>{stop}</option>)}
            </select>
          </div>

          <div className={`planner-step ${travelDate ? "completed" : toStop ? "active" : "locked"}`}>
            <span className="step-number">3</span>
            <label htmlFor="planner-date"><span>Date</span><strong>When will you travel?</strong></label>
            <select id="planner-date" className="input-field" value={travelDate} disabled={!toStop} onChange={(event) => chooseDate(event.target.value)}>
              <option value="">Select travel date</option>
              {availableDates.map((date) => <option key={date} value={date}>{readableDate(date)}</option>)}
            </select>
          </div>
        </section>

        <section ref={departureSectionRef} className="departure-section" aria-labelledby="departure-heading">
          <div className="departure-heading">
            <div><h2 id="departure-heading">Choose a departure</h2></div>
            {travelDate && <span><CalendarDays aria-hidden className="size-4" /> {readableDate(travelDate)}</span>}
          </div>

          {!travelDate ? (
            <div className="departure-empty"><Clock aria-hidden className="size-6" /><p>Complete From, To and Date to see departures.</p></div>
          ) : departures.length === 0 ? (
            <div className="departure-empty"><CalendarDays aria-hidden className="size-6" /><p>No departures are scheduled for this journey on the selected date.</p></div>
          ) : (
            <div className="departure-list">
              {departures.map((trip) => {
                const boardingTime = new Date(trip.boardingStop?.plannedDeparture ?? trip.departureTime);
                const eligibility = trip.boardingStop?.bookingEligibility;
                const canCheckSeats = eligibility?.canReserve === true && !isBookingRestricted;
                return (
                  <article key={trip.id} className="departure-row">
                    <div className="departure-time-block"><span>Departure</span><time className="departure-time" dateTime={boardingTime.toISOString()}>{formatMytTime(boardingTime)}</time></div>
                    <div className="departure-route"><strong>{trip.routeName}</strong><span>{fromStop} → {toStop}</span></div>
                    <div className="departure-meta"><span className="badge badge-blue">{trip.status.replaceAll("_", " ")}</span><span>Bus {trip.busPlateNumber}</span>{trip.expectedDelayMinutes ? <span className="badge badge-amber">Expected +{trip.expectedDelayMinutes} min</span> : null}<small>{eligibilityMessage(eligibility?.reason, eligibility?.opensAt)}</small></div>
                    <button type="button" disabled={!canCheckSeats} aria-describedby={`eligibility-${trip.id}`} onClick={() => onOpenSeatModal(trip.id, trip.boardingStop.id, trip.dropOffStop.id)} className="btn-secondary departure-seat-action"><Ticket aria-hidden className="size-4" /> {canCheckSeats ? "Check seats" : "Unavailable"}</button>
                    <span id={`eligibility-${trip.id}`} className="sr-only">{eligibilityMessage(eligibility?.reason, eligibility?.opensAt)}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </div>

        <aside className="planner-summary" aria-label="Selected journey summary">
          <p className="eyebrow">Your journey</p>
          {fromStop && toStop ? (
            <>
              <div className="summary-route"><MapPin aria-hidden className="size-5" /><div><strong>{fromStop}</strong><ArrowRight aria-hidden className="size-4" /><strong>{toStop}</strong></div></div>
              {selectedRoute && <div className="summary-topology"><span>{selectedRoute.name}</span><ConnectedRouteLine stops={selectedRoute.stops || []} fromStop={fromStop} toStop={toStop} /></div>}
              <p className="summary-note">Seat availability is checked for your complete From → To journey after you choose a departure.</p>
            </>
          ) : (
            <div className="planner-empty"><Bus aria-hidden className="size-7" /><p>Your route summary will appear as you choose stops.</p></div>
          )}
        </aside>
        </div>
      </div>
    </div>
  );
}
