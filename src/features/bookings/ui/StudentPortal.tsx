"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import ConfirmModal from "@/components/ConfirmModal";
import SeatGrid, { SeatItem } from "@/components/SeatGrid";
import { DynamicQRModal, type DynamicPassDescriptor } from "@/features/boarding/ui";
import { PenaltyAppealModal, PenaltiesTab } from "@/features/penalties/ui";
import RestrictedBanner from "@/components/student/RestrictedBanner";
import NextTripBanner from "@/components/student/NextTripBanner";
import FeaturedRouteCard from "@/components/student/FeaturedRouteCard";
import TripsTab from "@/features/bookings/ui/TripsTab";
import MyBookingsTab from "@/features/bookings/ui/MyBookingsTab";
import { TrackBusTab } from "@/features/location/ui";
import { useCurrentUser } from "@/features/identity/ui";
import { useTrips } from "@/features/trips/ui";
import { productPolicy } from "@/shared/config/policies";
import type { CurrentUser } from "@/shared/ui/current-user";

import { Bus, Ticket, Navigation, CreditCard, X, AlertCircle } from "lucide-react";

export default function StudentPortal({ initialUser }: { initialUser: CurrentUser }) {
  const [activeTab, setActiveTab] = useState<
    "trips" | "bookings" | "track" | "penalties"
  >("trips");
  const { user, fetchUser } = useCurrentUser(initialUser);

  // Trips state
  const [routes, setRoutes] = useState<any[]>([]);
  const { trips, fetchTrips } = useTrips();

  // Seat booking modal state
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [selectedJourney, setSelectedJourney] = useState<{
    boardingTripStopId: string;
    dropOffTripStopId: string;
    boardingStopName: string;
    dropOffStopName: string;
  } | null>(null);
  const [tripSeats, setTripSeats] = useState<SeatItem[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // My Bookings state
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myWaitlist, setMyWaitlist] = useState<any[]>([]);
  const [myWalkIns, setMyWalkIns] = useState<any[]>([]);
  const [activePass, setActivePass] = useState<DynamicPassDescriptor | null>(null);

  // Tracked trip for real-time location
  const [trackedTrip, setTrackedTrip] = useState<any>(null);

  // Penalties state
  const [penalties, setPenalties] = useState<any[]>([]);
  const [appealPenalty, setAppealPenalty] = useState<any>(null);

  useEffect(() => {
    fetchRoutes();
    fetchBookings();
    fetchWalkIns();
    fetchPenalties();
  }, []);

  useEffect(() => {
    if (!selectedTrip) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTrip(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTrip]);

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/routes");
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function fetchBookings() {
    try {
      const res = await fetch("/api/bookings/mine");
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings || []);
        setMyWaitlist(data.waitlist || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function fetchWalkIns() {
    try {
      const response = await fetch("/api/walk-ins");
      if (response.ok) {
        const data = await response.json();
        setMyWalkIns(data.intents || []);
      }
    } catch (error: any) {
      toast.error(error.message || "Unable to load Walk-in Passes");
    }
  }

  function openReservedPass(booking: any) {
    setActivePass({
      endpoint: `/api/bookings/${booking.id}/qr-token`,
      title: "Reserved Boarding Pass",
      purpose: "Reserved Boarding",
      routeName: booking.trip.routeName,
      journey: `${booking.boardingStopName} → ${booking.dropOffStopName}`,
      seatNumber: booking.seatNumber,
    });
  }

  function openWalkInPass(intent: any) {
    setActivePass({
      endpoint: `/api/walk-ins/${intent.id}/pass`,
      title: "Walk-in Boarding Pass",
      purpose: "Walk-in Boarding",
      routeName: intent.trip.routeName,
      journey: `${intent.boardingStopName} → ${intent.dropOffStopName}`,
      warning: "This pass does not guarantee boarding. Standing capacity is checked when scanned.",
    });
  }

  function openAlightingPass(kind: "RESERVED" | "WALK_IN", record: any) {
    setActivePass({
      endpoint: "/api/passes/alighting",
      requestBody: { kind, recordId: record.id },
      title: "Exit / Alighting Pass",
      purpose: "Alighting",
      routeName: record.trip.routeName,
      journey: `${record.boardingStopName} → ${record.dropOffStopName}`,
    });
  }

  async function fetchPenalties() {
    try {
      const res = await fetch("/api/penalties/mine");
      if (res.ok) {
        const data = await res.json();
        setPenalties(data.penalties || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function openSeatBookingModal(
    tripId: string,
    boardingTripStopId?: string,
    dropOffTripStopId?: string,
  ) {
    if (!boardingTripStopId || !dropOffTripStopId) {
      toast.error("Select a From and To stop before checking seats");
      return;
    }
    setBookingError(null);
    setSelectedSeatId(null);
    try {
      const params = new URLSearchParams({
        tripId,
        boardingTripStopId,
        dropOffTripStopId,
      });
      const res = await fetch(`/api/bookings/availability?${params}`);
      const data = await res.json();
      if (res.ok) {
        const trip = trips.find((candidate) => candidate.id === tripId);
        setSelectedTrip(trip);
        setSelectedJourney(data.availability.journey);
        setTripSeats(
          data.availability.seats.map((seat: { id: string; seatNumber: number }) => ({
            ...seat,
            status: "AVAILABLE" as const,
          })),
        );
      } else {
        toast.error(data.error?.message || "Unable to check journey seats");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function handleConfirmBooking() {
    if (!selectedTrip) return;
    setBookingLoading(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          boardingTripStopId: selectedJourney?.boardingTripStopId,
          dropOffTripStopId: selectedJourney?.dropOffTripStopId,
          tripSeatId: selectedSeatId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error?.message || data.error || "Booking failed");
        setBookingLoading(false);
        return;
      }

      setSelectedTrip(null);
      await Promise.all([fetchBookings(), fetchTrips()]);
      setActiveTab("bookings");
      toast.success("Reserved seat confirmed");
    } catch {
      setBookingError("Network error completing booking");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleJoinWaitlist() {
    if (!selectedTrip || !selectedJourney) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          boardingTripStopId: selectedJourney.boardingTripStopId,
          dropOffTripStopId: selectedJourney.dropOffTripStopId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error?.message || "Unable to join waitlist");
        return;
      }
      setSelectedTrip(null);
      await fetchBookings();
      setActiveTab("bookings");
      toast.success("Added to the journey waitlist");
    } catch {
      setBookingError("Network error joining waitlist");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleGenerateWalkInPass() {
    if (!selectedTrip || !selectedJourney) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const response = await fetch("/api/walk-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          boardingTripStopId: selectedJourney.boardingTripStopId,
          dropOffTripStopId: selectedJourney.dropOffTripStopId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBookingError(data.error?.message || "Unable to create Walk-in Pass");
        return;
      }
      const intent = {
        ...data,
        boardingStopName: selectedJourney.boardingStopName,
        dropOffStopName: selectedJourney.dropOffStopName,
        trip: { routeName: selectedTrip.routeName },
      };
      setSelectedTrip(null);
      await fetchWalkIns();
      openWalkInPass(intent);
    } catch {
      setBookingError("Network error generating Walk-in Pass");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleLeaveWaitlist(entryId: string) {
    const res = await fetch(`/api/waitlist/${entryId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error?.message || "Unable to leave waitlist");
      return;
    }
    toast.success("Waitlist request cancelled");
    fetchBookings();
  }

    async function handleCancelBooking(bookingId: string) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        toast.success("Booking cancelled successfully");
        fetchBookings();
        fetchTrips();
      } else {
        const data = await res.json();
        toast.error(data.error?.message || data.error || "Failed to cancel booking");
      }
    } catch (err: any) { toast.error(err.message || "Network error"); }
  }

  const activeBookingsCount = myBookings.filter(
    (b) => b.status === "CONFIRMED"
  ).length + myWaitlist.filter((entry) => entry.status === "WAITING").length;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header>
          <h1 className="section-title">Student Shuttle Portal</h1>
          <p className="section-subtitle">Reserve a seat, request a non-guaranteed walk-in pass, or track an active shuttle.</p>
        </header>
        {/* Restricted Warning Banner */}
        <RestrictedBanner
          isBookingRestricted={
            (user?.creditScore ?? productPolicy.initialCredit) <
            productPolicy.bookingRestrictionBelowCredit
          }
          onViewPenalties={() => setActiveTab("penalties")}
        />

        {/* Next Trip Banner */}
        <NextTripBanner
          myBookings={myBookings}
          onViewQR={openReservedPass}
        />

        <FeaturedRouteCard
          trips={trips}
          onBrowseRoutes={() => {
            setActiveTab("trips");
          }}
        />

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="tab-bar flex-1 min-w-0 overflow-x-auto" role="tablist" aria-label="Student portal sections">
            {[
              {
                id: "trips",
                icon: <Bus className="w-4 h-4" />,
                label: "Book Shuttle",
                badge: undefined as number | undefined,
              },
              {
                id: "bookings",
                icon: <Ticket className="w-4 h-4" />,
                label: "My Bookings",
                badge: activeBookingsCount as number | undefined,
              },
              {
                id: "track",
                icon: <Navigation className="w-4 h-4" />,
                label: "Track Bus",
                badge: undefined as number | undefined,
              },
              {
                id: "penalties",
                icon: <CreditCard className="w-4 h-4" />,
                label: "Penalties & Appeals",
                badge: undefined as number | undefined,
              },
            ].map(({ id, icon, label, badge }) => (
              <button
                key={id}
                onClick={() =>
                  setActiveTab(
                    id as "trips" | "bookings" | "track" | "penalties"
                  )
                }
                role="tab"
                aria-selected={activeTab === id}
                className={`tab-item ${activeTab === id ? "active" : ""}`}
              >
                {icon}
                {label}
                {badge != null && badge > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={
                      activeTab === id
                        ? { background: "rgba(255,255,255,0.25)" }
                        : {
                            background: "var(--accent-primary)",
                            color: "white",
                          }
                    }
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: BOOK SHUTTLE */}
        {activeTab === "trips" && (
          <TripsTab
            routes={routes}
            trips={trips}
            isBookingRestricted={
              (user?.creditScore ?? productPolicy.initialCredit) <
              productPolicy.bookingRestrictionBelowCredit
            }
            onRefresh={fetchTrips}
            onOpenSeatModal={openSeatBookingModal}
            onTrackTrip={(t) => {
              setTrackedTrip(t);
              setActiveTab("track");
            }}
          />
        )}

        {/* TAB 2: MY BOOKINGS */}
        {activeTab === "bookings" && (
          <MyBookingsTab
            myBookings={myBookings}
            waitlistEntries={myWaitlist}
            walkInIntents={myWalkIns}
            onRefresh={() => { void fetchBookings(); void fetchWalkIns(); }}
            onBrowseTrips={() => setActiveTab("trips")}
            onOpenQR={openReservedPass}
            onOpenWalkInQR={openWalkInPass}
            onOpenAlightingQR={openAlightingPass}
            onTrackTrip={(trip) => {
              setTrackedTrip(trip);
              setActiveTab("track");
            }}
            onCancelBooking={(id) => setConfirmCancelId(id)}
            onLeaveWaitlist={handleLeaveWaitlist}
          />
        )}

        {/* TAB 3: TRACK BUS */}
        {activeTab === "track" && (
          <TrackBusTab
            trips={trips}
            trackedTrip={trackedTrip}
            setTrackedTrip={setTrackedTrip}
            user={user}
            onBrowseTrips={() => setActiveTab("trips")}
          />
        )}

        {/* TAB 4: PENALTIES & APPEALS */}
        {activeTab === "penalties" && (
          <PenaltiesTab
            user={user}
            penalties={penalties}
            onOpenAppealModal={setAppealPenalty}
          />
        )}
      </main>

      {/* SEAT SELECTION MODAL */}
      {selectedTrip && (
        <div className="modal-overlay">
          <div role="dialog" aria-modal="true" aria-labelledby="seat-dialog-title" className="modal-content w-full max-w-2xl p-6 relative">
            <button
              autoFocus
              onClick={() => setSelectedTrip(null)}
              aria-label="Close seat selection"
              className="absolute top-4 right-4 p-2 rounded-xl transition-all duration-200"
              style={{
                color: "var(--text-muted)",
                background: "var(--bg-surface)",
              }}
            >
              <X className="w-4 h-4" />
            </button>

            <h2
              id="seat-dialog-title"
              className="text-xl font-bold mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Select Seat — {selectedTrip.routeName}
            </h2>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              Bus: {selectedTrip.busPlateNumber} • Departs:{" "}
              {new Date(selectedTrip.departureTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {selectedJourney && (
              <p className="text-xs mb-5" style={{ color: "var(--accent-secondary)" }}>
                {selectedJourney.boardingStopName} → {selectedJourney.dropOffStopName}
              </p>
            )}

            {bookingError && (
              <div
                className="p-3 mb-4 rounded-xl text-xs flex items-center gap-2"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {bookingError}
              </div>
            )}

            <SeatGrid
              seats={tripSeats}
              selectedSeatId={selectedSeatId}
              onSelectSeat={(seatId) => setSelectedSeatId(seatId)}
              mode="student"
            />
            {tripSeats.length === 0 && (
              <p className="mt-4 text-xs font-semibold text-amber-200">
                No single seat is free across this complete journey.
              </p>
            )}

            <div
              className="mt-5 flex items-center justify-between pt-4 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selectedSeatId
                  ? "Seat selected. Your seat is guaranteed after booking confirmation."
                  : "Please select an available seat"}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTrip(null)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>

                {tripSeats.filter((s) => s.status === "AVAILABLE").length >
                0 ? (
                  <button
                    disabled={!selectedSeatId || bookingLoading}
                    onClick={handleConfirmBooking}
                    className="btn-primary text-xs"
                  >
                    {bookingLoading ? "Confirming…" : "Confirm Reserved Seat"}
                  </button>
                ) : (
                  <button
                    disabled={bookingLoading}
                    onClick={handleJoinWaitlist}
                    className="btn-primary text-xs"
                    style={{
                      background: "linear-gradient(135deg, #d97706, #f59e0b)",
                    }}
                  >
                    {bookingLoading ? "Joining..." : "Join Waitlist"}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-xs text-amber-200">
                Prefer standing walk-in? This does not reserve capacity or guarantee boarding. Capacity is checked only when the driver scans the pass.
              </p>
              <button disabled={bookingLoading} onClick={handleGenerateWalkInPass} className="btn-ghost text-xs shrink-0">
                Generate Walk-in Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC QR MODAL */}
      {activePass && (
        <DynamicQRModal
          pass={activePass}
          onClose={() => setActivePass(null)}
        />
      )}

      {/* PENALTY APPEAL MODAL */}
      {appealPenalty && (
        <PenaltyAppealModal
          penalty={appealPenalty}
          onClose={() => setAppealPenalty(null)}
          onSuccess={() => {
            fetchPenalties();
            fetchUser();
          }}
        />
      )}
      <ConfirmModal
        isOpen={!!confirmCancelId}
        onClose={() => setConfirmCancelId(null)}
        onConfirm={() => { if (confirmCancelId) handleCancelBooking(confirmCancelId); }}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        isDestructive={true}
      />
    </div>
  );
}
