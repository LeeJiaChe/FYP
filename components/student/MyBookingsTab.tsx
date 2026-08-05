"use client";

import { Ticket, RefreshCw, Clock, QrCode, Navigation } from "lucide-react";

interface MyBookingsTabProps {
  myBookings: any[];
  onRefresh: () => void;
  onBrowseTrips: () => void;
  onOpenQR: (booking: any) => void;
  onTrackTrip: (trip: any) => void;
  onCancelBooking: (bookingId: string) => void;
}

export default function MyBookingsTab({
  myBookings,
  onRefresh,
  onBrowseTrips,
  onOpenQR,
  onTrackTrip,
  onCancelBooking,
}: MyBookingsTabProps) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title text-xl">My Bookings</h2>
          <p className="section-subtitle">
            Your reserved shuttles & boarding passes
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="btn-ghost flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {myBookings.length === 0 ? (
        <div
          className="py-16 text-center rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <Ticket
            className="w-10 h-10 mx-auto mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p
            className="font-bold"
            style={{ color: "var(--text-secondary)" }}
          >
            No bookings yet
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Browse the schedule to book a seat!
          </p>
          <button
            onClick={onBrowseTrips}
            className="btn-primary mt-4 text-xs"
          >
            Browse Trips
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {myBookings.map((b, idx) => {
            const isTooLate = new Date(b.trip.departureTime).getTime() - Date.now() < 30 * 60 * 1000;
            return (
            <div
              key={b.id}
              className="rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center gap-5 transition-all duration-200 animate-slide-up"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                animationDelay: `${idx * 60}ms`,
              }}
            >
              <div
                className="w-1 self-stretch rounded-full shrink-0 hidden md:block"
                style={{
                  background:
                    b.status === "CONFIRMED"
                      ? "var(--accent-primary)"
                      : b.status === "WAITLISTED"
                        ? "#f59e0b"
                        : b.status === "COMPLETED"
                          ? "#22c55e"
                          : "var(--border)",
                }}
              />

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="badge"
                    style={
                      b.status === "CONFIRMED"
                        ? {
                            background: "rgba(99,102,241,0.15)",
                            color: "var(--accent-secondary)",
                            borderColor: "var(--border-hover)",
                          }
                        : b.status === "WAITLISTED"
                          ? {
                              background: "rgba(245,158,11,0.15)",
                              color: "#fbbf24",
                              borderColor: "rgba(245,158,11,0.3)",
                            }
                          : b.status === "COMPLETED"
                            ? {
                                background: "rgba(34,197,94,0.15)",
                                color: "#4ade80",
                                borderColor: "rgba(34,197,94,0.3)",
                              }
                            : {
                                background: "var(--bg-surface)",
                                color: "var(--text-muted)",
                                borderColor: "var(--border)",
                              }
                    }
                  >
                    {b.status === "WAITLISTED"
                      ? `WAITLISTED #${b.waitlistPosition}`
                      : b.status}
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: "var(--accent-secondary)" }}
                  >
                    {b.trip.busPlateNumber}
                  </span>
                </div>

                <h3
                  className="font-bold text-base"
                  style={{ color: "var(--text-primary)" }}
                >
                  {b.trip.routeName}
                </h3>

                <div
                  className="flex flex-wrap items-center gap-4 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="flex items-center gap-1">
                    <Clock
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--accent-secondary)" }}
                    />
                    {new Date(b.trip.departureTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {b.seatNumber && (
                    <span
                      className="font-bold px-2 py-0.5 rounded-lg"
                      style={{
                        background: "var(--accent-glow)",
                        color: "var(--accent-secondary)",
                        border: "1px solid var(--border-hover)",
                      }}
                    >
                      Seat #{b.seatNumber}
                    </span>
                  )}
                  {b.checkInMethod && (
                    <span
                      className="font-medium"
                      style={{ color: "#4ade80" }}
                    >
                      ✓ Checked in via {b.checkInMethod}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {b.status === "CONFIRMED" && (
                  <>
                    <button
                      onClick={() => onOpenQR(b)}
                      className="btn-primary flex items-center gap-1.5 text-xs"
                    >
                      <QrCode className="w-4 h-4" />
                      Boarding Pass
                    </button>
                    <button
                      onClick={() => onTrackTrip(b.trip)}
                      className="btn-ghost flex items-center gap-1.5 text-xs"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Track
                    </button>
                    <button
                      onClick={() => onCancelBooking(b.id)}
                      disabled={isTooLate}
                      className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                      style={{
                        color: "#f87171",
                        borderColor: "rgba(239,68,68,0.3)",
                      }}
                    >
                      {isTooLate ? "Too late to cancel" : "Cancel"}
                    </button>
                  </>
                )}
                {b.status === "WAITLISTED" && (
                  <button
                    onClick={() => onCancelBooking(b.id)}
                    className="btn-ghost text-xs"
                    style={{ color: "#f87171" }}
                  >
                    Leave Waitlist
                  </button>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
