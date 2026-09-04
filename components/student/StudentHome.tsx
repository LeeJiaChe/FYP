"use client";

import {
  ArrowRight,
  Bus,
  Clock,
  CreditCard,
  MapPin,
  Navigation,
  Ticket,
} from "lucide-react";

import RestrictedBanner from "@/components/student/RestrictedBanner";
import { selectStudentEtaBooking } from "@/features/bookings/ui/student-journey-presentation";
import { StudentBookingEtaCard } from "@/features/eta/ui";
import { formatMytDate, formatMytTime, getMytHour } from "@/shared/time/operational-time";

interface StudentHomeUser {
  name?: string | null;
  creditScore?: number | null;
}

interface StudentHomeBooking {
  id?: string;
  status: string;
  checkedInAt?: string | null;
  actualAlightedAt?: string | null;
  boardingStopName?: string;
  dropOffStopName?: string;
  trip?: {
    departureTime?: string;
    status?: string;
    routeName?: string;
    route?: { name?: string };
  };
}

interface StudentHomeProps {
  user: StudentHomeUser | null;
  bookings: StudentHomeBooking[];
  bookingsStatus: "loading" | "ready" | "error";
  currentTime: string;
  activeJourneyCount: number;
  isRestricted: boolean;
  defaultCreditScore: number;
  onPlanJourney: () => void;
  onViewJourneys: () => void;
  onTrackShuttle: () => void;
  onViewAccount: () => void;
  onOpenReservedPass: (booking: StudentHomeBooking) => void;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDeparture(value?: string) {
  if (!value) return null;
  const departure = new Date(value);
  if (Number.isNaN(departure.getTime())) return null;

  return {
    dateTime: value,
    day: formatMytDate(departure, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    time: formatMytTime(departure),
  };
}

export default function StudentHome({
  user,
  bookings,
  bookingsStatus,
  currentTime,
  activeJourneyCount,
  isRestricted,
  defaultCreditScore,
  onPlanJourney,
  onViewJourneys,
  onTrackShuttle,
  onViewAccount,
  onOpenReservedPass,
}: StudentHomeProps) {
  const timeSnapshot = new Date(currentTime);
  const now = timeSnapshot.getTime();
  const nextBooking = bookings
    .filter((booking) => {
      const departureTime = booking.trip?.departureTime;
      return (
        booking.status === "CONFIRMED" &&
        departureTime != null &&
        new Date(departureTime).getTime() > now
      );
    })
    .sort(
      (a, b) =>
        new Date(a.trip?.departureTime ?? 0).getTime() -
        new Date(b.trip?.departureTime ?? 0).getTime(),
    )[0];
  const etaBooking = selectStudentEtaBooking(bookings, now);
  const nextDeparture = formatDeparture(nextBooking?.trip?.departureTime);
  const score = user?.creditScore ?? defaultCreditScore;
  const fullName = user?.name?.trim() || "Student";
  const greeting = greetingForHour(getMytHour(timeSnapshot));

  return (
    <div className="student-home student-home-pilot">
      <header className="student-home-hero">
        <div className="student-home-hero-copy">
          <p className="student-home-greeting">{greeting}</p>
          <h1>{fullName}</h1>
          <p className="student-home-context">Plan your campus journey.</p>
        </div>

        <div className="student-home-brand-cue" aria-label="TAR UMT campus shuttle">
          <span aria-hidden="true"><Bus /></span>
          <span>TAR UMT<br />Campus shuttle</span>
        </div>

        <div className="student-home-transit-visual" aria-hidden="true">
          <span className="transit-node is-start" />
          <span className="transit-line" />
          <span className="transit-node" />
          <span className="transit-line is-short" />
          <span className="transit-node is-end" />
          <span className="transit-shuttle"><Bus /></span>
        </div>

        {nextBooking && nextDeparture ? (
          <button
            type="button"
            onClick={() => onOpenReservedPass(nextBooking)}
            className="student-home-hero-action"
          >
            <span>
              <small>Next journey</small>
              <strong>{nextDeparture.time}</strong>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        ) : (
          <div className="student-home-hero-note">
            <MapPin aria-hidden="true" />
            <span>KL Main Campus</span>
          </div>
        )}
      </header>

      <RestrictedBanner
        isBookingRestricted={isRestricted}
        onViewPenalties={onViewAccount}
      />

      {etaBooking?.id && (
        <section className="student-home-eta-section my-3" aria-label="Current or next journey arrival estimate">
          <StudentBookingEtaCard bookingId={etaBooking.id} />
        </section>
      )}

      <section className="student-home-primary" aria-labelledby="student-home-plan-title">
        <div className="student-home-primary-copy">
          <span className="student-home-primary-icon" aria-hidden="true"><Navigation /></span>
          <div>
            <h2 id="student-home-plan-title">Where would you like to go?</h2>
            <p>Choose your stops, then compare scheduled shuttle departures.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onPlanJourney}
          className="student-home-route-picker"
          aria-label="Choose boarding stop and destination"
        >
          <span className="route-picker-rail" aria-hidden="true">
            <i />
            <b />
            <i />
          </span>
          <span className="route-picker-stop">
            <small>Boarding</small>
            <strong>Choose boarding stop</strong>
          </span>
          <span className="route-picker-stop">
            <small>Destination</small>
            <strong>Choose destination</strong>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>

        <button type="button" onClick={onPlanJourney} className="student-home-primary-cta">
          <span>Find a shuttle</span>
          <span aria-hidden="true"><ArrowRight /></span>
        </button>
      </section>

      <section className="student-home-quick" aria-labelledby="student-home-quick-title">
        <div className="student-home-quick-heading">
          <h2 id="student-home-quick-title">Quick access</h2>
          <p>Your most useful shuttle tools.</p>
        </div>

        <div className="student-home-quick-grid">
          <button
            type="button"
            onClick={onViewJourneys}
            className="student-home-quick-card journey-card"
          >
            <span className="quick-card-icon" aria-hidden="true"><Ticket /></span>
            <span className="quick-card-copy">
              <span className="quick-card-title-row">
                <strong>My journeys</strong>
                {bookingsStatus === "ready" && (
                  <span className="quick-card-count tabular-nums">{activeJourneyCount}</span>
                )}
              </span>
              {bookingsStatus === "loading" && <small>Checking your journeys</small>}
              {bookingsStatus === "error" && <small>Journey status unavailable</small>}
              {bookingsStatus === "ready" && nextBooking && nextDeparture && (
                <span className="quick-journey-detail">
                  <span>{nextBooking.trip?.routeName || nextBooking.trip?.route?.name || "Scheduled journey"}</span>
                  <span><Clock aria-hidden="true" /> {nextDeparture.day}, {nextDeparture.time}</span>
                </span>
              )}
              {bookingsStatus === "ready" && !nextBooking && (
                <small>{activeJourneyCount ? `${activeJourneyCount} active request${activeJourneyCount === 1 ? "" : "s"}` : "No active journeys"}</small>
              )}
            </span>
            <ArrowRight className="quick-card-arrow" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onTrackShuttle}
            className="student-home-quick-card track-card"
          >
            <span className="quick-card-icon" aria-hidden="true"><Navigation /></span>
            <span className="quick-card-copy">
              <strong>Track shuttle</strong>
              <small>Open the live trip view</small>
            </span>
            <ArrowRight className="quick-card-arrow" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onViewAccount}
            className="student-home-quick-card credit-card"
          >
            <span className="quick-card-icon" aria-hidden="true"><CreditCard /></span>
            <span className="quick-card-copy">
              <strong>Passenger credit</strong>
              <span className="quick-credit-value tabular-nums">{score}<small>/100</small></span>
              <small>{isRestricted ? "Reservation restricted" : "Booking available"}</small>
            </span>
            <ArrowRight className="quick-card-arrow" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
