"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import ConfirmModal from "@/components/ConfirmModal";
import SeatGrid, { SeatItem } from "@/components/SeatGrid";
import DynamicQRModal from "@/components/DynamicQRModal";
import PenaltyAppealModal from "@/components/PenaltyAppealModal";
import RestrictedBanner from "@/components/student/RestrictedBanner";
import NextTripBanner from "@/components/student/NextTripBanner";
import Route36HighlightCard from "@/components/student/Route36HighlightCard";
import TripsTab from "@/components/student/TripsTab";
import MyBookingsTab from "@/components/student/MyBookingsTab";
import TrackBusTab from "@/components/student/TrackBusTab";
import PenaltiesTab from "@/components/student/PenaltiesTab";
import { useAuth } from "@/hooks/useAuth";
import { useTrips } from "@/hooks/useTrips";

import { Bus, Ticket, Navigation, CreditCard, X, AlertCircle } from "lucide-react";

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<
    "trips" | "bookings" | "track" | "penalties"
  >("trips");
  const { user, fetchUser } = useAuth();

  // Trips state
  const [routes, setRoutes] = useState<any[]>([]);
  const { trips, loadingTrips, fetchTrips } = useTrips();
  const [searchQuery, setSearchQuery] = useState("");

  // Seat booking modal state
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [tripSeats, setTripSeats] = useState<SeatItem[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // My Bookings state
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [activeQRBooking, setActiveQRBooking] = useState<any>(null);

  // Tracked trip for real-time location
  const [trackedTrip, setTrackedTrip] = useState<any>(null);

  // Penalties state
  const [penalties, setPenalties] = useState<any[]>([]);
  const [appealPenalty, setAppealPenalty] = useState<any>(null);

  useEffect(() => {
    fetchRoutes();
    fetchBookings();
    fetchPenalties();
  }, []);

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
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
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

  async function openSeatBookingModal(tripId: string) {
    setBookingError(null);
    setSelectedSeatId(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTrip(data.trip);
        setTripSeats(data.trip.seats || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function handleConfirmBooking(isWaitlist: boolean = false) {
    if (!selectedTrip) return;
    setBookingLoading(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          seatId: isWaitlist ? undefined : selectedSeatId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || "Booking failed");
        setBookingLoading(false);
        return;
      }

      setSelectedTrip(null);
      fetchBookings();
      fetchTrips();
      setActiveTab("bookings");
    } catch {
      setBookingError("Network error completing booking");
    } finally {
      setBookingLoading(false);
    }
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
        toast.error(data.error || "Failed to cancel booking");
      }
    } catch (err: any) { toast.error(err.message || "Network error"); }
  }

  // Filter trips by search query
  const filteredTrips = trips.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.routeName?.toLowerCase().includes(q) ||
      t.busPlateNumber?.toLowerCase().includes(q) ||
      t.routeStops?.some((s: string) => s.toLowerCase().includes(q))
    );
  });

  const activeBookingsCount = myBookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "WAITLISTED"
  ).length;

  const availableSeatsCount = trips.reduce(
    (a, t) => a + (t.stats?.availableSeats || 0),
    0
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Restricted Warning Banner */}
        <RestrictedBanner
          isBookingRestricted={user?.isBookingRestricted}
          onViewPenalties={() => setActiveTab("penalties")}
        />

        {/* Next Trip Banner */}
        <NextTripBanner
          myBookings={myBookings}
          onViewQR={(booking) => setActiveQRBooking(booking)}
        />

        {/* Route 3->6 Highlight Card */}
        <Route36HighlightCard
          trips={trips}
          onSelectRoute={() => {
            setActiveTab("trips");
          }}
        />

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="tab-bar flex-1 min-w-0 overflow-x-auto">
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
            loadingTrips={loadingTrips}
            isBookingRestricted={user?.isBookingRestricted}
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
            onRefresh={fetchBookings}
            onBrowseTrips={() => setActiveTab("trips")}
            onOpenQR={setActiveQRBooking}
            onTrackTrip={(trip) => {
              setTrackedTrip(trip);
              setActiveTab("track");
            }}
            onCancelBooking={(id) => setConfirmCancelId(id)}
          />
        )}

        {/* TAB 3: TRACK BUS */}
        {activeTab === "track" && (
          <TrackBusTab
            trips={trips}
            trackedTrip={trackedTrip}
            setTrackedTrip={setTrackedTrip}
            user={user}
            onOpenSeatModal={openSeatBookingModal}
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
          <div className="modal-content w-full max-w-2xl p-6 relative">
            <button
              onClick={() => setSelectedTrip(null)}
              className="absolute top-4 right-4 p-2 rounded-xl transition-all duration-200"
              style={{
                color: "var(--text-muted)",
                background: "var(--bg-surface)",
              }}
            >
              <X className="w-4 h-4" />
            </button>

            <h2
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

            <div
              className="mt-5 flex items-center justify-between pt-4 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selectedSeatId
                  ? "✓ Seat selected"
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
                    onClick={() => handleConfirmBooking(false)}
                    className="btn-primary text-xs"
                  >
                    {bookingLoading ? "Confirming..." : "Confirm Booking"}
                  </button>
                ) : (
                  <button
                    disabled={bookingLoading}
                    onClick={() => handleConfirmBooking(true)}
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
          </div>
        </div>
      )}

      {/* DYNAMIC QR MODAL */}
      {activeQRBooking && (
        <DynamicQRModal
          booking={activeQRBooking}
          onClose={() => setActiveQRBooking(null)}
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
