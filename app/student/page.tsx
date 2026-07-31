"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import SeatGrid, { SeatItem } from "@/components/SeatGrid";
import DynamicQRModal from "@/components/DynamicQRModal";
import PenaltyAppealModal from "@/components/PenaltyAppealModal";
import RestrictedBanner from "@/components/student/RestrictedBanner";
import HeroStatsRow from "@/components/student/HeroStatsRow";
import Route36HighlightCard from "@/components/student/Route36HighlightCard";
import TripsTab from "@/components/student/TripsTab";
import MyBookingsTab from "@/components/student/MyBookingsTab";
import TrackBusTab from "@/components/student/TrackBusTab";
import PenaltiesTab from "@/components/student/PenaltiesTab";

import { Bus, Ticket, Navigation, CreditCard, X, AlertCircle } from "lucide-react";

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<
    "trips" | "bookings" | "track" | "penalties"
  >("trips");
  const [user, setUser] = useState<any>(null);

  // Trips state
  const [trips, setTrips] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Seat booking modal state
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [tripSeats, setTripSeats] = useState<SeatItem[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
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
    fetchUser();
    fetchRoutes();
    fetchBookings();
    fetchPenalties();
  }, []);

  useEffect(() => {
    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouteId]);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {}
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/routes");
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch {}
  }

  async function fetchTrips() {
    setLoadingTrips(true);
    try {
      let url = "/api/trips";
      if (selectedRouteId) url += `?routeId=${selectedRouteId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
      }
    } catch {
    } finally {
      setLoadingTrips(false);
    }
  }

  async function fetchBookings() {
    try {
      const res = await fetch("/api/bookings/mine");
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings || []);
      }
    } catch {}
  }

  async function fetchPenalties() {
    try {
      const res = await fetch("/api/penalties/mine");
      if (res.ok) {
        const data = await res.json();
        setPenalties(data.penalties || []);
      }
    } catch {}
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
    } catch {}
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
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchBookings();
        fetchTrips();
      }
    } catch {}
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

        {/* Hero Stats Row */}
        <HeroStatsRow
          activeTripsCount={trips.length}
          availableSeatsCount={availableSeatsCount}
          activeBookingsCount={activeBookingsCount}
          creditScore={user?.creditScore ?? 100}
        />

        {/* Route 3->6 Highlight Card */}
        <Route36HighlightCard
          trips={trips}
          onSelectRoute={() => {
            setSelectedRouteId("");
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

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border shrink-0"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border)",
              color: (user?.creditScore ?? 100) < 40 ? "#f87171" : "#4ade80",
            }}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{user?.creditScore ?? 100} / 100 pts</span>
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
            onCancelBooking={handleCancelBooking}
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
    </div>
  );
}
