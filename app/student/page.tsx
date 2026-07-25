"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import SeatGrid, { SeatItem } from "@/components/SeatGrid";
import DynamicQRModal from "@/components/DynamicQRModal";
import PenaltyAppealModal from "@/components/PenaltyAppealModal";
import BusLocationTracker from "@/components/BusLocationTracker";
import {
  Bus,
  Clock,
  QrCode,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Search,
  Filter,
  Ticket,
  ChevronRight,
  ShieldAlert,
  Navigation,
  X,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

// ─── Route 3→6 card data ──────────────────────────────────────
const ROUTE_36_STOPS = [
  "Main Gate",
  "Block 3",
  "Block 4",
  "Block 5",
  "Block 6 Terminal",
];

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
      const res = await fetch("/api/admin/routes");
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
    (b) => b.status === "CONFIRMED" || b.status === "WAITLISTED",
  ).length;

  // Stats for the hero section
  const totalSeats = trips.reduce((a, t) => a + (t.stats?.totalSeats || 0), 0);
  const availableSeats = trips.reduce(
    (a, t) => a + (t.stats?.availableSeats || 0),
    0,
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Restricted Warning Banner ── */}
        {user?.isBookingRestricted && (
          <div
            className="p-4 rounded-2xl flex items-center justify-between gap-4 animate-slide-up"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert
                className="w-6 h-6 shrink-0"
                style={{ color: "#f87171" }}
              />
              <div>
                <span
                  className="font-bold text-sm block"
                  style={{ color: "#fca5a5" }}
                >
                  Booking Privilege Restricted
                </span>
                <span className="text-xs" style={{ color: "#f87171" }}>
                  Your credit score is below 40 pts due to unexcused no-shows.
                  Submit an appeal to restore privileges.
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("penalties")}
              className="px-4 py-2 text-xs font-bold text-white rounded-xl shrink-0 transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #ef4444, #f87171)",
              }}
            >
              View Penalties
            </button>
          </div>
        )}

        {/* ── Hero Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
          {[
            {
              icon: <Bus className="w-5 h-5 text-white" />,
              label: "Active Trips",
              value: trips.length,
              color: "var(--accent-primary)",
            },
            {
              icon: <Users className="w-5 h-5 text-white" />,
              label: "Available Seats",
              value: availableSeats,
              color: "#22c55e",
            },
            {
              icon: <Ticket className="w-5 h-5 text-white" />,
              label: "My Bookings",
              value: activeBookingsCount,
              color: "#f59e0b",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-white" />,
              label: "Credit Score",
              value: `${user?.creditScore ?? 100}`,
              color: (user?.creditScore ?? 100) < 40 ? "#ef4444" : "#10b981",
            },
          ].map((stat, i) => (
            <div key={i} className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${stat.color}, ${stat.color}cc)`,
                  }}
                >
                  {stat.icon}
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-muted)" }}
                >
                  {stat.label}
                </span>
              </div>
              <span
                className="text-2xl font-extrabold"
                style={{ color: "var(--text-primary)" }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Route 3→6 Highlight Card ── */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 animate-slide-up"
          style={{
            background:
              "linear-gradient(135deg, var(--accent-primary)22, var(--accent-secondary)11)",
            border: "1px solid var(--border-hover)",
          }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 opacity-5 float-animation">
            <Bus className="w-full h-full" />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="live-dot w-2.5 h-2.5 rounded-full"
                  style={{ background: "#4ade80", display: "inline-block" }}
                />
                <span
                  className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: "#4ade80" }}
                >
                  Live Route
                </span>
              </div>
              <h2
                className="text-xl font-extrabold"
                style={{ color: "var(--text-primary)" }}
              >
                Route 3 → 6
              </h2>
              <div className="flex flex-wrap gap-1.5 items-center">
                {ROUTE_36_STOPS.map((stop, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-md font-semibold"
                      style={{
                        background: "var(--accent-glow)",
                        color: "var(--accent-secondary)",
                        border: "1px solid var(--border-hover)",
                      }}
                    >
                      {stop}
                    </span>
                    {i < ROUTE_36_STOPS.length - 1 && (
                      <ChevronRight
                        className="w-3 h-3"
                        style={{ color: "var(--text-muted)" }}
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Next Departure
                </p>
                <p
                  className="font-bold text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {trips.find(
                    (t) =>
                      t.routeStops?.includes("Block 3") ||
                      t.routeStops?.includes("Block 6"),
                  )
                    ? new Date(
                        trips.find(
                          (t) =>
                            t.routeStops?.includes("Block 3") ||
                            t.routeStops?.includes("Block 6"),
                        ).departureTime,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "View Schedule"}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedRouteId("");
                  setActiveTab("trips");
                }}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Navigation className="w-3.5 h-3.5" />
                Book This Route
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
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
                    id as "trips" | "bookings" | "track" | "penalties",
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

          {/* Credit score badge */}
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

        {/* ══ TAB 1: TRIP SCHEDULE & BOOKING ══ */}
        {activeTab === "trips" && (
          <div className="space-y-5 animate-fade-in">
            {/* Filter & Search Bar */}
            <div
              className="flex flex-wrap items-center gap-3 p-4 rounded-2xl"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <Search
                  className="w-4 h-4 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search routes, stops, bus plate..."
                  className="bg-transparent outline-none flex-1 text-xs"
                  style={{ color: "var(--text-primary)" }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Filter
                  className="w-4 h-4 shrink-0"
                  style={{ color: "var(--accent-secondary)" }}
                />
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="input-field py-1.5 text-xs w-auto"
                  style={{ minWidth: "160px" }}
                >
                  <option value="">All Routes</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchTrips}
                className="btn-ghost flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {/* Trip Cards */}
            {loadingTrips ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-52 skeleton rounded-2xl" />
                ))}
              </div>
            ) : filteredTrips.length === 0 ? (
              <div
                className="py-16 text-center rounded-2xl"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <Bus
                  className="w-10 h-10 mx-auto mb-3"
                  style={{ color: "var(--text-muted)" }}
                />
                <p
                  className="font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  No trips found
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Try adjusting your filter or search query
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTrips.map((t, idx) => {
                  const isFull = t.stats.availableSeats === 0;
                  const occupancyPct = Math.round(
                    ((t.stats.totalSeats - t.stats.availableSeats) /
                      t.stats.totalSeats) *
                      100,
                  );

                  return (
                    <div
                      key={t.id}
                      className="trip-card flex flex-col justify-between gap-4 animate-slide-up"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <span
                            className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg"
                            style={{
                              background: "var(--accent-glow)",
                              color: "var(--accent-secondary)",
                              border: "1px solid var(--border-hover)",
                            }}
                          >
                            {t.busPlateNumber}
                          </span>
                          <span
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                            style={{
                              background:
                                t.status === "BOARDING"
                                  ? "rgba(34,197,94,0.15)"
                                  : t.status === "DELAYED"
                                    ? "rgba(245,158,11,0.15)"
                                    : "var(--bg-surface)",
                              color:
                                t.status === "BOARDING"
                                  ? "#4ade80"
                                  : t.status === "DELAYED"
                                    ? "#fbbf24"
                                    : "var(--text-muted)",
                              border: `1px solid ${
                                t.status === "BOARDING"
                                  ? "rgba(34,197,94,0.3)"
                                  : t.status === "DELAYED"
                                    ? "rgba(245,158,11,0.3)"
                                    : "var(--border)"
                              }`,
                            }}
                          >
                            {t.status.replace("_", " ")}
                          </span>
                        </div>

                        <h3
                          className="font-bold text-base leading-snug"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {t.routeName}
                        </h3>

                        {/* Stops */}
                        <div className="flex flex-wrap gap-1">
                          {t.routeStops.map((stop: string, i: number) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                              style={{
                                background: "var(--bg-surface)",
                                color: "var(--text-muted)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {stop}
                            </span>
                          ))}
                        </div>

                        {/* Time */}
                        <div
                          className="flex items-center justify-between p-3 rounded-xl text-xs"
                          style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Clock
                              className="w-4 h-4"
                              style={{ color: "var(--accent-secondary)" }}
                            />
                            <div>
                              <span
                                className="text-[10px] block"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Departs
                              </span>
                              <span
                                className="font-bold"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {new Date(t.departureTime).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                          </div>
                          <ChevronRight
                            className="w-4 h-4"
                            style={{ color: "var(--text-muted)" }}
                          />
                          <div className="text-right">
                            <span
                              className="text-[10px] block"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Arrives
                            </span>
                            <span
                              className="font-semibold"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {new Date(
                                t.estimatedArrivalTime,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Occupancy bar */}
                        <div>
                          <div
                            className="flex justify-between text-[10px] mb-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <span>{t.stats.availableSeats} seats free</span>
                            <span>{occupancyPct}% full</span>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${occupancyPct}%`,
                                background: isFull
                                  ? "linear-gradient(90deg, #ef4444, #f87171)"
                                  : occupancyPct > 70
                                    ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                                    : `linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openSeatBookingModal(t.id)}
                          disabled={!!user?.isBookingRestricted}
                          className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5"
                          style={
                            isFull
                              ? {
                                  background:
                                    "linear-gradient(135deg, #d97706, #f59e0b)",
                                }
                              : {}
                          }
                        >
                          {isFull ? "Join Waitlist" : "Select Seat"}
                        </button>
                        <button
                          onClick={() => {
                            setTrackedTrip(t);
                            setActiveTab("track");
                          }}
                          className="btn-ghost p-2.5"
                          title="Track this bus"
                        >
                          <Navigation
                            className="w-4 h-4"
                            style={{ color: "var(--accent-secondary)" }}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 2: MY BOOKINGS ══ */}
        {activeTab === "bookings" && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title text-xl">My Bookings</h2>
                <p className="section-subtitle">
                  Your reserved shuttles & boarding passes
                </p>
              </div>
              <button
                onClick={fetchBookings}
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
                  onClick={() => setActiveTab("trips")}
                  className="btn-primary mt-4 text-xs"
                >
                  Browse Trips
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map((b, idx) => (
                  <div
                    key={b.id}
                    className="rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center gap-5 transition-all duration-200 animate-slide-up"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      animationDelay: `${idx * 60}ms`,
                    }}
                  >
                    {/* Status stripe */}
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
                          {new Date(b.trip.departureTime).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                          )}
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
                            onClick={() => setActiveQRBooking(b)}
                            className="btn-primary flex items-center gap-1.5 text-xs"
                          >
                            <QrCode className="w-4 h-4" />
                            Boarding Pass
                          </button>
                          <button
                            onClick={() => {
                              setTrackedTrip(b.trip);
                              setActiveTab("track");
                            }}
                            className="btn-ghost flex items-center gap-1.5 text-xs"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Track
                          </button>
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="btn-ghost text-xs"
                            style={{
                              color: "#f87171",
                              borderColor: "rgba(239,68,68,0.3)",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {b.status === "WAITLISTED" && (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="btn-ghost text-xs"
                          style={{ color: "#f87171" }}
                        >
                          Leave Waitlist
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 3: REAL-TIME BUS TRACKER ══ */}
        {activeTab === "track" && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="section-title text-xl">Real-Time Bus Tracker</h2>
              <p className="section-subtitle">
                Live location & ETA for your bus
              </p>
            </div>

            {/* Trip selector */}
            <div
              className="flex flex-wrap items-center gap-3 p-4 rounded-2xl"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <Navigation
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--accent-secondary)" }}
              />
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                Select Trip to Track:
              </label>
              <select
                value={trackedTrip?.id || ""}
                onChange={(e) => {
                  const t = trips.find((x) => x.id === e.target.value);
                  setTrackedTrip(t || null);
                }}
                className="input-field py-1.5 text-xs"
                style={{ maxWidth: "300px" }}
              >
                <option value="">-- Select a trip --</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.routeName} ({t.busPlateNumber}) —{" "}
                    {new Date(t.departureTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </option>
                ))}
              </select>
            </div>

            {trackedTrip ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Main tracker */}
                <div className="lg:col-span-2">
                  <BusLocationTracker
                    tripId={trackedTrip.id}
                    routeName={trackedTrip.routeName}
                    stops={trackedTrip.routeStops || ROUTE_36_STOPS}
                    departureTime={trackedTrip.departureTime}
                    estimatedArrivalTime={trackedTrip.estimatedArrivalTime}
                    busPlateNumber={trackedTrip.busPlateNumber}
                    status={trackedTrip.status}
                  />
                </div>

                {/* Trip details sidebar */}
                <div
                  className="rounded-2xl p-5 space-y-4"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h3
                    className="font-bold text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Trip Details
                  </h3>

                  <div className="space-y-3">
                    {[
                      { label: "Route", value: trackedTrip.routeName },
                      { label: "Bus Plate", value: trackedTrip.busPlateNumber },
                      {
                        label: "Status",
                        value: trackedTrip.status.replace("_", " "),
                      },
                      {
                        label: "Departure",
                        value: new Date(
                          trackedTrip.departureTime,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      },
                      {
                        label: "Est. Arrival",
                        value: new Date(
                          trackedTrip.estimatedArrivalTime,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      },
                      {
                        label: "Available Seats",
                        value: `${trackedTrip.stats?.availableSeats ?? "—"} / ${trackedTrip.stats?.totalSeats ?? "—"}`,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span style={{ color: "var(--text-muted)" }}>
                          {label}
                        </span>
                        <span
                          className="font-bold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Stops timeline */}
                  <div
                    className="pt-3 border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p
                      className="text-xs font-bold mb-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Route Stops
                    </p>
                    <div className="space-y-2">
                      {(trackedTrip.routeStops || ROUTE_36_STOPS).map(
                        (stop: string, i: number, arr: string[]) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  background:
                                    i === 0
                                      ? "#4ade80"
                                      : i === arr.length - 1
                                        ? "var(--accent-primary)"
                                        : "var(--border)",
                                  border: "2px solid var(--bg-card)",
                                  boxShadow:
                                    i === 0 || i === arr.length - 1
                                      ? "0 0 8px var(--accent-glow)"
                                      : "none",
                                }}
                              />
                              {i < arr.length - 1 && (
                                <div
                                  className="w-0.5 h-4 mt-1"
                                  style={{ background: "var(--border)" }}
                                />
                              )}
                            </div>
                            <span
                              className="text-xs"
                              style={{
                                color:
                                  i === 0
                                    ? "#4ade80"
                                    : i === arr.length - 1
                                      ? "var(--accent-secondary)"
                                      : "var(--text-muted)",
                                fontWeight:
                                  i === 0 || i === arr.length - 1
                                    ? "700"
                                    : "400",
                              }}
                            >
                              {stop}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Quick book */}
                  {(trackedTrip.stats?.availableSeats ?? 0) > 0 && (
                    <button
                      onClick={() => openSeatBookingModal(trackedTrip.id)}
                      disabled={!!user?.isBookingRestricted}
                      className="btn-primary w-full text-xs flex items-center justify-center gap-2 mt-2"
                    >
                      <Ticket className="w-4 h-4" />
                      Book This Bus
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="py-16 text-center rounded-2xl"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <Navigation
                  className="w-10 h-10 mx-auto mb-3 float-animation"
                  style={{ color: "var(--text-muted)" }}
                />
                <p
                  className="font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Select a trip above to track
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Real-time bus position and ETA will appear here
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 4: PENALTIES & APPEALS ══ */}
        {activeTab === "penalties" && (
          <div className="space-y-5 animate-fade-in">
            {/* Score overview */}
            <div
              className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex-1 space-y-1">
                <h2 className="section-title text-xl">
                  Credit Score & Penalty Record
                </h2>
                <p className="section-subtitle">
                  Each unexcused no-show deducts 15 credit points. Scores below
                  40 restrict future booking.
                </p>
              </div>

              <div
                className="text-center p-5 rounded-2xl min-w-[160px]"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  className="text-[10px] uppercase font-bold block mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Current Score
                </span>
                <span
                  className="text-4xl font-extrabold block"
                  style={{
                    color:
                      (user?.creditScore ?? 100) < 40 ? "#f87171" : "#4ade80",
                  }}
                >
                  {user?.creditScore ?? 100}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  / 100
                </span>
                <div className="mt-2 progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${user?.creditScore ?? 100}%`,
                      background:
                        (user?.creditScore ?? 100) < 40
                          ? "linear-gradient(90deg, #ef4444, #f87171)"
                          : "linear-gradient(90deg, var(--accent-primary), #4ade80)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Penalties list */}
            <div className="space-y-4">
              {penalties.length === 0 ? (
                <div
                  className="py-16 text-center rounded-2xl"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <CheckCircle2
                    className="w-10 h-10 mx-auto mb-3"
                    style={{ color: "#4ade80" }}
                  />
                  <p
                    className="font-bold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Clean record!
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No penalty points or active restrictions.
                  </p>
                </div>
              ) : (
                penalties.map((p, idx) => (
                  <div
                    key={p.id}
                    className="rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 animate-slide-up"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      animationDelay: `${idx * 60}ms`,
                    }}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-red">
                          -{p.creditPointsDeducted} pts
                        </span>
                        <span
                          className="badge"
                          style={
                            p.status === "ACTIVE"
                              ? {
                                  background: "rgba(239,68,68,0.1)",
                                  color: "#f87171",
                                  borderColor: "rgba(239,68,68,0.3)",
                                }
                              : p.status === "APPEALED"
                                ? {
                                    background: "rgba(245,158,11,0.1)",
                                    color: "#fbbf24",
                                    borderColor: "rgba(245,158,11,0.3)",
                                  }
                                : p.status === "OVERTURNED"
                                  ? {
                                      background: "rgba(34,197,94,0.1)",
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
                          {p.status}
                        </span>
                      </div>
                      <h3
                        className="font-semibold text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.reason}
                      </h3>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {p.booking.routeName} •{" "}
                        {new Date(p.booking.departureTime).toLocaleDateString()}
                      </p>

                      {p.appeal && (
                        <div
                          className="mt-2 p-3 rounded-xl text-xs"
                          style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <span
                            className="block font-bold mb-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Your Appeal:
                          </span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            "{p.appeal.reason}"
                          </span>
                          {p.appeal.adminComment && (
                            <div
                              className="mt-2 pt-2 border-t"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <span
                                className="font-bold"
                                style={{ color: "var(--accent-secondary)" }}
                              >
                                Staff Response:{" "}
                              </span>
                              <span style={{ color: "var(--text-secondary)" }}>
                                {p.appeal.adminComment}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {p.status === "ACTIVE" && !p.appeal && (
                      <button
                        onClick={() => setAppealPenalty(p)}
                        className="btn-primary text-xs flex items-center gap-2 shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, #d97706, #f59e0b)",
                        }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        Submit Appeal
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── SEAT SELECTION MODAL ── */}
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

      {/* ── DYNAMIC QR MODAL ── */}
      {activeQRBooking && (
        <DynamicQRModal
          booking={activeQRBooking}
          onClose={() => setActiveQRBooking(null)}
        />
      )}

      {/* ── PENALTY APPEAL MODAL ── */}
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
