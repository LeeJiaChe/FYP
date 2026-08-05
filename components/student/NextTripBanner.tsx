"use client";

import { Bus, Clock, MapPin, Ticket } from "lucide-react";

interface NextTripBannerProps {
  myBookings: any[];
  onViewQR: (booking: any) => void;
}

export default function NextTripBanner({ myBookings, onViewQR }: NextTripBannerProps) {
  // Find the next upcoming booking (closest departure time in the future)
  const now = new Date().getTime();
  const upcomingBookings = myBookings
    .filter((b) => b.status === "CONFIRMED" && b.trip?.departureTime && new Date(b.trip.departureTime).getTime() > now)
    .sort((a, b) => new Date(a.trip!.departureTime).getTime() - new Date(b.trip!.departureTime).getTime());

  const nextBooking = upcomingBookings[0];

  return (
    <div
      className="rounded-2xl p-6 relative overflow-hidden animate-slide-up"
      style={{
        background: `linear-gradient(135deg, var(--bg-card), var(--bg-surface))`,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 30px var(--shadow-color)",
      }}
    >
      {/* Decorative background element */}
      <div 
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-10 pointer-events-none"
        style={{ background: "var(--accent-primary)", filter: "blur(40px)" }}
      />
      
      <div className="relative z-10">
        <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-muted)" }}>UP NEXT</h2>
        
        {nextBooking ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
                style={{ background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))" }}
              >
                <Bus className="w-6 h-6 text-white" />
              </div>
              
              <div>
                <h3 className="text-xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {nextBooking.trip.routeName || nextBooking.trip.route?.name || "Unknown Route"}
                </h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--accent-primary)" }} />
                    {nextBooking.trip.departureTime 
                      ? new Date(nextBooking.trip.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Unknown time"}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" style={{ color: "var(--accent-secondary)" }} />
                    {nextBooking.trip.busPlateNumber || nextBooking.trip.bus?.plateNumber || "Unknown Bus"}
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => onViewQR(nextBooking)}
              className="btn-primary whitespace-nowrap flex items-center justify-center gap-2 px-5 py-2.5 sm:w-auto w-full"
            >
              <Ticket className="w-4 h-4" />
              View QR Ticket
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                No upcoming trips
              </h3>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                You have no scheduled bookings at the moment.
              </p>
            </div>
            <button
              onClick={() => {
                // Scroll down to the Book Shuttle tab area
                document.getElementById("student-tabs")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn-ghost flex items-center justify-center gap-2"
            >
              <Bus className="w-4 h-4" />
              Book a Shuttle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
