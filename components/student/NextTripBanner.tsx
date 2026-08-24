"use client";

import { ArrowRight, Bus, Clock, MapPin, Ticket } from "lucide-react";

interface NextBooking {
  status: string;
  trip: {
    departureTime: string;
    routeName?: string;
    route?: { name?: string };
    busPlateNumber?: string;
    bus?: { plateNumber?: string };
  };
}

interface NextTripBannerProps {
  myBookings: NextBooking[];
  onViewQR: (booking: NextBooking) => void;
}

export default function NextTripBanner({ myBookings, onViewQR }: NextTripBannerProps) {
  // Find the next upcoming booking (closest departure time in the future)
  const now = new Date().getTime();
  const upcomingBookings = myBookings
    .filter((b) => b.status === "CONFIRMED" && b.trip?.departureTime && new Date(b.trip.departureTime).getTime() > now)
    .sort((a, b) => new Date(a.trip!.departureTime).getTime() - new Date(b.trip!.departureTime).getTime());

  const nextBooking = upcomingBookings[0];

  return (
    <article className={`next-trip ${nextBooking ? "scheduled" : "empty"}`}>
      {nextBooking ? (
        <>
          <header className="next-trip-heading"><span>Next journey</span><time dateTime={nextBooking.trip.departureTime}>{new Date(nextBooking.trip.departureTime).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}</time></header>
          <div className="next-trip-main">
            <div className="next-trip-time"><Clock aria-hidden /><time dateTime={nextBooking.trip.departureTime}>{new Date(nextBooking.trip.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
            <div className="next-trip-route"><h2>{nextBooking.trip.routeName || nextBooking.trip.route?.name || "Unknown Route"}</h2><p><MapPin aria-hidden /> {nextBooking.trip.busPlateNumber || nextBooking.trip.bus?.plateNumber || "Bus assignment pending"}</p></div>
          </div>
          <button onClick={() => onViewQR(nextBooking)} className="next-trip-action"><Ticket aria-hidden /> Boarding pass <ArrowRight aria-hidden /></button>
        </>
      ) : (
        <div className="next-trip-empty-copy"><span><Bus aria-hidden /></span><div><h2>No journey scheduled</h2><p>Plan your next campus trip when you are ready.</p></div></div>
      )}
    </article>
  );
}
