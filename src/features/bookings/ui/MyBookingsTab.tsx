"use client";

import { DoorOpen, Navigation, QrCode, RefreshCw, Ticket } from "lucide-react";

import { StudentBookingEtaCard } from "@/features/eta/ui";
import { formatMytDate, formatMytDateTime, formatMytTime } from "@/shared/time/operational-time";
import { useOperationalClock } from "@/shared/ui/useOperationalClock";
import {
  classifyStudentJourney,
  shouldShowStudentJourneyEta,
} from "./student-journey-presentation";

interface Props {
  myBookings: any[];
  waitlistEntries: any[];
  walkInIntents: any[];
  onRefresh: () => void;
  onBrowseTrips: () => void;
  onOpenQR: (booking: any) => void;
  onOpenWalkInQR: (intent: any) => void;
  onOpenAlightingQR: (kind: "RESERVED" | "WALK_IN", record: any) => void;
  onTrackTrip: (trip: any) => void;
  onCancelBooking: (id: string) => void;
  onLeaveWaitlist: (id: string) => void;
}

export default function MyBookingsTab(props: Props) {
  const { myBookings, waitlistEntries, walkInIntents } = props;
  const now = useOperationalClock();
  const activeBoarded = myBookings.filter(
    (booking) => classifyStudentJourney(booking, now) === "ACTIVE_BOARDED",
  );
  const future = myBookings
    .filter((booking) => classifyStudentJourney(booking, now) === "UPCOMING")
    .sort(
      (a, b) =>
        new Date(a.trip.departureTime).getTime() -
        new Date(b.trip.departureTime).getTime(),
    );
  const upcoming = [...activeBoarded, ...future];
  const past = myBookings.filter(
    (booking) => classifyStudentJourney(booking, now) === "PAST",
  );
  const empty =
    myBookings.length === 0 &&
    waitlistEntries.length === 0 &&
    walkInIntents.length === 0;

  function bookingRow(booking: any, focal = false) {
    const historical = classifyStudentJourney(booking, now) === "PAST";
    const stateClass = ["CANCELLED", "NO_SHOW"].includes(booking.status)
      ? "is-cancelled"
      : historical
        ? "is-historical"
        : "is-confirmed";
    return (
      <article key={booking.id} className={`journey-row ${stateClass} ${focal ? "focal" : ""}`}>
        <div className="journey-time">
          <time>{formatMytTime(booking.trip.departureTime)}</time>
          <span>{formatMytDate(booking.trip.departureTime, { day: "numeric", month: "short" })}</span>
        </div>
        <div className="journey-main">
          <span className={`journey-status ${stateClass}`}>Reserved · {booking.status.replaceAll("_", " ")}</span>
          <h3>{booking.boardingStopName} → {booking.dropOffStopName}</h3>
          <p>{booking.trip.routeName} · Seat {booking.seatNumber}</p>
          {booking.checkedInAt && <small>Boarded via {booking.checkInMethod}</small>}
          {booking.actualAlightedAt && <small>Alighted via {booking.alightingMethod}</small>}
          {focal && shouldShowStudentJourneyEta(booking, now) && <div className="my-2"><StudentBookingEtaCard bookingId={booking.id} /></div>}
        </div>
        <div className="journey-actions">
          {booking.status === "CONFIRMED" && !booking.checkedInAt && <button onClick={() => props.onOpenQR(booking)} className="btn-primary"><QrCode aria-hidden className="size-4" /> Reserved Pass</button>}
          {booking.status === "CONFIRMED" && booking.checkedInAt && !booking.actualAlightedAt && <button onClick={() => props.onOpenAlightingQR("RESERVED", booking)} className="btn-primary"><DoorOpen aria-hidden className="size-4" /> Exit Pass</button>}
          <button onClick={() => props.onTrackTrip(booking.trip)} className="btn-ghost"><Navigation aria-hidden className="size-3.5" /> Track</button>
          {booking.status === "CONFIRMED" && !booking.checkedInAt && <button onClick={() => props.onCancelBooking(booking.id)} className="btn-ghost danger">Cancel</button>}
        </div>
      </article>
    );
  }

  return (
    <div className="journeys-view animate-fade-in">
      <header><div><p className="eyebrow">Passenger journeys</p><h1 className="section-title">My journeys</h1><p className="section-subtitle">Reserved seats, waitlist requests and non-guaranteed walk-in intentions.</p></div><button onClick={props.onRefresh} className="btn-ghost"><RefreshCw aria-hidden className="size-4" /> Refresh</button></header>
      {empty ? (
        <div className="journey-empty"><Ticket aria-hidden className="size-8" /><strong>No journeys yet</strong><button onClick={props.onBrowseTrips} className="btn-primary">Book a shuttle</button></div>
      ) : (
        <div className="journey-sections">
          {upcoming.length > 0 && <section><h2>{activeBoarded.length > 0 ? "Current / upcoming" : "Upcoming"} <span>{upcoming.length}</span></h2><div>{upcoming.map((booking, index) => bookingRow(booking, index === 0))}</div></section>}
          {(waitlistEntries.length > 0 || walkInIntents.length > 0) && (
            <section>
              <h2>Waitlist / Walk-in <span>{waitlistEntries.length + walkInIntents.length}</span></h2>
              <div>
                {walkInIntents.map((intent) => <article key={intent.id} className="journey-row alternative is-waitlist"><div className="journey-main"><span className="journey-status is-waitlist">Walk-in · {intent.status.replaceAll("_", " ")}</span><h3>{intent.boardingStopName} → {intent.dropOffStopName}</h3><p>{intent.trip.routeName}</p><small className="warning-copy">Boarding not guaranteed. Standing capacity is checked when the Driver verifies the pass.</small></div><div className="journey-actions">{intent.status === "PENDING" && <button onClick={() => props.onOpenWalkInQR(intent)} className="btn-primary"><QrCode aria-hidden className="size-4" /> Walk-in Pass</button>}{intent.journey?.status === "BOARDED" && !intent.journey.actualAlightedAt && <button onClick={() => props.onOpenAlightingQR("WALK_IN", { ...intent, id: intent.journey.id })} className="btn-primary"><DoorOpen aria-hidden className="size-4" /> Exit Pass</button>}</div></article>)}
                {waitlistEntries.map((entry) => <article key={entry.id} className="journey-row alternative is-waitlist"><div className="journey-main"><span className="journey-status is-waitlist">Waitlist · {entry.status.replaceAll("_", " ")}</span><h3>{entry.boardingStopName} → {entry.dropOffStopName}</h3><p>{entry.trip.routeName} · queued {formatMytDateTime(entry.queuedAt)} MYT</p><small className="warning-copy">Waiting for a journey-specific seat. This is not a confirmed reservation.</small></div>{entry.status === "WAITING" && <div className="journey-actions"><button onClick={() => props.onLeaveWaitlist(entry.id)} className="btn-ghost danger">Leave waitlist</button></div>}</article>)}
              </div>
            </section>
          )}
          {past.length > 0 && <section><h2>Past <span>{past.length}</span></h2><div>{past.map((booking) => bookingRow(booking))}</div></section>}
        </div>
      )}
    </div>
  );
}
