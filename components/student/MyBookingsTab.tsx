"use client";

import { Clock, DoorOpen, Navigation, QrCode, RefreshCw, Ticket } from "lucide-react";

interface MyBookingsTabProps {
  myBookings: any[];
  waitlistEntries: any[];
  walkInIntents: any[];
  onRefresh: () => void;
  onBrowseTrips: () => void;
  onOpenQR: (booking: any) => void;
  onOpenWalkInQR: (intent: any) => void;
  onOpenAlightingQR: (kind: "RESERVED" | "WALK_IN", record: any) => void;
  onTrackTrip: (trip: any) => void;
  onCancelBooking: (bookingId: string) => void;
  onLeaveWaitlist: (entryId: string) => void;
}

export default function MyBookingsTab({
  myBookings,
  waitlistEntries,
  walkInIntents,
  onRefresh,
  onBrowseTrips,
  onOpenQR,
  onOpenWalkInQR,
  onOpenAlightingQR,
  onTrackTrip,
  onCancelBooking,
  onLeaveWaitlist,
}: MyBookingsTabProps) {
  const empty = myBookings.length === 0 && waitlistEntries.length === 0 && walkInIntents.length === 0;
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="section-title text-xl">My journeys and passes</h2><p className="section-subtitle">Reserved seats, waitlist requests and non-guaranteed walk-in intentions</p></div>
        <button onClick={onRefresh} className="btn-ghost flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {empty ? (
        <div className="py-16 text-center rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Ticket className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="font-bold" style={{ color: "var(--text-secondary)" }}>No journeys yet</p>
          <button onClick={onBrowseTrips} className="btn-primary mt-4 text-xs">Browse Trips</button>
        </div>
      ) : (
        <div className="space-y-4">
          {myBookings.map((booking) => (
            <article key={booking.id} className="rounded-2xl p-5 flex flex-col md:flex-row gap-5 md:items-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex-1 space-y-2">
                <span className="badge">RESERVED · {booking.status}</span>
                <h3 className="font-bold">{booking.trip.routeName}</h3>
                <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span><Clock className="inline w-3 h-3" /> {new Date(booking.trip.departureTime).toLocaleString()}</span>
                  <strong>Seat {booking.seatNumber}</strong>
                  <span>{booking.boardingStopName} → {booking.dropOffStopName}</span>
                  {booking.checkedInAt && <span className="text-emerald-400">Boarded via {booking.checkInMethod}</span>}
                  {booking.actualAlightedAt && <span className="text-cyan-400">Alighted via {booking.alightingMethod}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {booking.status === "CONFIRMED" && !booking.checkedInAt && <button onClick={() => onOpenQR(booking)} className="btn-primary text-xs"><QrCode className="inline w-4 h-4" /> Reserved Pass</button>}
                {booking.status === "CONFIRMED" && booking.checkedInAt && !booking.actualAlightedAt && <button onClick={() => onOpenAlightingQR("RESERVED", booking)} className="btn-primary text-xs"><DoorOpen className="inline w-4 h-4" /> Exit Pass</button>}
                <button onClick={() => onTrackTrip(booking.trip)} className="btn-ghost text-xs"><Navigation className="inline w-3 h-3" /> Track</button>
                {booking.status === "CONFIRMED" && !booking.checkedInAt && <button onClick={() => onCancelBooking(booking.id)} className="btn-ghost text-xs text-red-400">Cancel</button>}
              </div>
            </article>
          ))}

          {walkInIntents.map((intent) => (
            <article key={intent.id} className="rounded-2xl p-5 flex flex-col md:flex-row gap-5 md:items-center border border-amber-500/30 bg-amber-500/5">
              <div className="flex-1 space-y-2">
                <span className="badge text-amber-300">WALK-IN · {intent.status}</span>
                <h3 className="font-bold">{intent.trip.routeName}</h3>
                <p className="text-xs text-slate-400">{intent.boardingStopName} → {intent.dropOffStopName}</p>
                <p className="text-xs font-semibold text-amber-200">This pass does not guarantee boarding. Standing capacity is checked when scanned.</p>
                {intent.journey && <p className="text-xs text-emerald-400">Boarded {new Date(intent.journey.boardedAt).toLocaleString()}{intent.journey.actualAlightedAt ? ` · alighted via ${intent.journey.alightingMethod}` : ""}</p>}
              </div>
              <div className="flex gap-2">
                {intent.status === "PENDING" && <button onClick={() => onOpenWalkInQR(intent)} className="btn-primary text-xs"><QrCode className="inline w-4 h-4" /> Walk-in Pass</button>}
                {intent.journey?.status === "BOARDED" && !intent.journey.actualAlightedAt && <button onClick={() => onOpenAlightingQR("WALK_IN", { ...intent, id: intent.journey.id })} className="btn-primary text-xs"><DoorOpen className="inline w-4 h-4" /> Exit Pass</button>}
              </div>
            </article>
          ))}

          {waitlistEntries.map((entry) => (
            <article key={entry.id} className="rounded-2xl p-5 flex flex-col md:flex-row gap-5 md:items-center border border-amber-500/30" style={{ background: "var(--bg-card)" }}>
              <div className="flex-1"><span className="badge text-amber-300">WAITLIST · {entry.status}</span><h3 className="font-bold mt-2">{entry.trip.routeName}</h3><p className="text-xs text-slate-400">{entry.boardingStopName} → {entry.dropOffStopName} · queued {new Date(entry.queuedAt).toLocaleString()}</p></div>
              {entry.status === "WAITING" && <button onClick={() => onLeaveWaitlist(entry.id)} className="btn-ghost text-xs text-red-400">Leave Waitlist</button>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
