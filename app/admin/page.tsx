"use client";

import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Navbar from "@/components/Navbar";
import SeatGrid, { SeatItem } from "@/components/SeatGrid";
import {
  Activity,
  Bus,
  MapPin,
  Calendar,
  CreditCard,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Users,
  Lightbulb,
} from "lucide-react";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"live" | "buses" | "routes" | "trips" | "appeals" | "analytics">("live");

  // Realtime Live Seat Monitoring state
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [liveTripDetails, setLiveTripDetails] = useState<any>(null);

  // CRUD Data State
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [utilizationData, setUtilizationData] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<string>("");
  const [noShowData, setNoShowData] = useState<any[]>([]);

  // Modals / Forms state
  const [showBusModal, setShowBusModal] = useState(false);
  const [newBus, setNewBus] = useState({ plateNumber: "", capacity: 20, status: "ACTIVE" });

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: "", stopsInput: "" });

  const [showTripModal, setShowTripModal] = useState(false);
  const [newTrip, setNewTrip] = useState({
    routeId: "",
    busId: "",
    driverId: "",
    departureTime: "",
    estimatedArrivalTime: "",
  });

  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [adminComment, setAdminComment] = useState("");

  useEffect(() => {
    fetchUser();
    fetchTrips();
    fetchBuses();
    fetchRoutes();
    fetchDrivers();
    fetchAppeals();
    // Analytics is heavy — fetch on demand when user opens that tab
  }, []);

  // Lazy-load analytics only when the tab is first opened
  useEffect(() => {
    if (activeTab === "analytics" && utilizationData.length === 0) {
      fetchAnalytics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Socket.io Real-time Connection Setup for Live Seat Matrix
  useEffect(() => {
    if (!selectedTripId) return;

    fetchTripDetails(selectedTripId);

    const socketUrl = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.emit("join-trip", selectedTripId);

    socket.on("seat-update", (data) => {
      fetchTripDetails(selectedTripId);
    });

    socket.on("trip-update", (data) => {
      fetchTripDetails(selectedTripId);
    });

    return () => {
      socket.emit("leave-trip", selectedTripId);
      socket.disconnect();
    };
  }, [selectedTripId]);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // ignore
    }
  }

  async function fetchTrips() {
    try {
      const res = await fetch("/api/trips");
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
        if (data.trips?.length > 0 && !selectedTripId) {
          setSelectedTripId(data.trips[0].id);
        }
      }
    } catch {
      // ignore
    }
  }

  async function fetchTripDetails(tripId: string) {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setLiveTripDetails(data.trip);
      }
    } catch {
      // ignore
    }
  }

  async function fetchBuses() {
    try {
      const res = await fetch("/api/admin/buses");
      if (res.ok) {
        const data = await res.json();
        setBuses(data.buses || []);
      }
    } catch {
      // ignore
    }
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/admin/routes");
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch {
      // ignore
    }
  }

  async function fetchDrivers() {
    try {
      const res = await fetch("/api/admin/drivers-list");
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
      }
    } catch {
      // ignore
    }
  }

  async function fetchAppeals() {
    try {
      const res = await fetch("/api/appeals");
      if (res.ok) {
        const data = await res.json();
        setAppeals(data.appeals || []);
      }
    } catch {
      // ignore
    }
  }

  async function fetchAnalytics() {
    try {
      const utilRes = await fetch("/api/analytics/utilization");
      if (utilRes.ok) {
        const utilData = await utilRes.json();
        setUtilizationData(utilData.data || []);
        setRecommendation(utilData.recommendation || "");
      }

      const noShowRes = await fetch("/api/analytics/no-show-rate");
      if (noShowRes.ok) {
        const noShowDataRes = await noShowRes.json();
        setNoShowData(noShowDataRes.data || []);
      }
    } catch {
      // ignore
    }
  }

  // CRUD actions
  async function handleCreateBus(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/buses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBus),
      });

      if (res.ok) {
        setShowBusModal(false);
        setNewBus({ plateNumber: "", capacity: 20, status: "ACTIVE" });
        fetchBuses();
      }
    } catch {
      // ignore
    }
  }

  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    const stops = newRoute.stopsInput.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoute.name, stops }),
      });

      if (res.ok) {
        setShowRouteModal(false);
        setNewRoute({ name: "", stopsInput: "" });
        fetchRoutes();
      }
    } catch {
      // ignore
    }
  }

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Convert the raw datetime-local strings to ISO only at submit time.
      // Storing ISO strings in state breaks the datetime-local input display.
      // Also strip empty driverId string → undefined so Zod UUID validation passes.
      const payload = {
        ...newTrip,
        driverId: newTrip.driverId || undefined,
        departureTime: newTrip.departureTime ? new Date(newTrip.departureTime).toISOString() : "",
        estimatedArrivalTime: newTrip.estimatedArrivalTime ? new Date(newTrip.estimatedArrivalTime).toISOString() : "",
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowTripModal(false);
        setNewTrip({ routeId: "", busId: "", driverId: "", departureTime: "", estimatedArrivalTime: "" });
        fetchTrips();
      } else {
        const errData = await res.json();
        alert(`Failed to schedule trip: ${errData.error || res.status}`);
      }
    } catch {
      // ignore
    }
  }

  async function handleReviewAppeal(appealId: string, status: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch(`/api/appeals/${appealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminComment }),
      });

      if (res.ok) {
        setSelectedAppeal(null);
        setAdminComment("");
        fetchAppeals();
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Admin Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="tab-bar">
            {(["live", "buses", "routes", "trips", "appeals", "analytics"] as const).map((tab) => {
              const icons: Record<string, React.ReactNode> = {
                live: <Activity className="w-4 h-4 live-dot" style={{ color: "#4ade80" }} />,
                buses: <Bus className="w-4 h-4" />,
                routes: <MapPin className="w-4 h-4" />,
                trips: <Calendar className="w-4 h-4" />,
                appeals: <CreditCard className="w-4 h-4" />,
                analytics: <BarChart3 className="w-4 h-4" />,
              };
              const labels: Record<string, string> = {
                live: "Live Fleet",
                buses: "Buses",
                routes: "Routes",
                trips: "Timetable",
                appeals: "Appeals",
                analytics: "Analytics",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`tab-item ${activeTab === tab ? "active" : ""}`}
                >
                  {icons[tab]}
                  {labels[tab]}
                  {tab === "appeals" && appeals.filter((a) => a.status === "PENDING").length > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={activeTab === "appeals" ? { background: "rgba(255,255,255,0.25)" } : { background: "#f59e0b", color: "#1a1a1a" }}
                    >
                      {appeals.filter((a) => a.status === "PENDING").length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: REAL-TIME FLEET OCCUPANCY */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-fade-in">
            <div
              className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              style={{ border: "1px solid var(--border)" }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full live-dot" style={{ background: "#4ade80", display: "inline-block" }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#4ade80" }}>
                    Socket.io Service Active
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>Real-Time Seat Occupancy</h1>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <label className="text-xs font-semibold shrink-0" style={{ color: "var(--text-secondary)" }}>Active Trip:</label>
                <select
                  value={selectedTripId || ""}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="input-field py-2 text-xs"
                  style={{ maxWidth: "300px" }}
                >
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.routeName} ({t.busPlateNumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {liveTripDetails ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div
                  className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{liveTripDetails.routeName}</h2>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        Bus: <span className="font-bold" style={{ color: "var(--accent-secondary)" }}>{liveTripDetails.busPlateNumber}</span> • Driver:{" "}
                        <span style={{ color: "var(--text-primary)" }}>{liveTripDetails.driverName}</span>
                      </p>
                    </div>
                    <span
                      className="badge"
                      style={{ background: "var(--accent-glow)", color: "var(--accent-secondary)", borderColor: "var(--border-hover)" }}
                    >
                      {liveTripDetails.status}
                    </span>
                  </div>
                  <SeatGrid seats={liveTripDetails.seats || []} mode="admin" interactive={false} />
                </div>

                <div className="space-y-4">
                  <div
                    className="glass-card p-5 rounded-2xl space-y-4"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Occupancy Summary</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {[
                        { label: "Total Capacity", value: `${liveTripDetails.busCapacity}`, color: "var(--text-primary)" },
                        { label: "Available", value: liveTripDetails.seats?.filter((s: any) => s.status === "AVAILABLE").length, color: "var(--text-primary)" },
                        { label: "Reserved", value: liveTripDetails.seats?.filter((s: any) => s.status === "RESERVED").length, color: "#f87171" },
                        { label: "Checked In", value: liveTripDetails.seats?.filter((s: any) => s.status === "CHECKED_IN").length, color: "#4ade80" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="p-3 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                          <span className="text-[10px] block mb-1" style={{ color: "var(--text-muted)" }}>{label}</span>
                          <span className="text-xl font-extrabold" style={{ color }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Select a trip to load live seat matrix.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BUSES CRUD */}
        {activeTab === "buses" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="section-title text-xl">Bus Fleet Management</h2>
                <p className="section-subtitle">{buses.length} buses registered</p>
              </div>
              <button onClick={() => setShowBusModal(true)} className="btn-primary flex items-center gap-1.5 text-xs">
                <Plus className="w-4 h-4" /> Add Bus
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {buses.map((b, idx) => (
                <div
                  key={b.id}
                  className="glass-card p-5 rounded-2xl space-y-3 animate-slide-up"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-lg" style={{ color: "var(--text-primary)" }}>{b.plateNumber}</span>
                    <span
                      className="badge"
                      style={b.status === "ACTIVE"
                        ? { background: "rgba(34,197,94,0.15)", color: "#4ade80", borderColor: "rgba(34,197,94,0.3)" }
                        : { background: "rgba(245,158,11,0.15)", color: "#fbbf24", borderColor: "rgba(245,158,11,0.3)" }}
                    >
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Capacity: <span className="font-bold" style={{ color: "var(--text-primary)" }}>{b.capacity} Seats</span>
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Trips Scheduled: {b._count?.trips || 0}</p>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (b._count?.trips || 0) * 10)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ROUTES CRUD */}
        {activeTab === "routes" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="section-title text-xl">Routes Management</h2>
                <p className="section-subtitle">{routes.length} routes configured</p>
              </div>
              <button onClick={() => setShowRouteModal(true)} className="btn-primary flex items-center gap-1.5 text-xs">
                <Plus className="w-4 h-4" /> Add Route
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {routes.map((r, idx) => (
                <div
                  key={r.id}
                  className="glass-card p-5 rounded-2xl space-y-3 animate-slide-up"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{r.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {r.stops.map((stop: string, i: number) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium"
                        style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                      >
                        {stop}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{r.stops.length} stops</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TIMETABLE & TRIPS */}
        {activeTab === "trips" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Shuttle Timetable & Trip Scheduler</h2>
              <button
                onClick={() => setShowTripModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Schedule New Trip
              </button>
            </div>

            <div className="space-y-4">
              {trips.map((t) => (
                <div key={t.id} className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {t.busPlateNumber}
                    </span>
                    <h3 className="font-bold text-base text-white mt-1">{t.routeName}</h3>
                    <p className="text-xs text-slate-400">
                      Driver: <span className="text-slate-200">{t.driverName}</span> • Departure:{" "}
                      <span className="text-emerald-400 font-semibold">{new Date(t.departureTime).toLocaleString()}</span>
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl">
                    Status: {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: PENALTY APPEALS REVIEW QUEUE */}
        {activeTab === "appeals" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-white">Student Penalty Appeal Queue</h2>

            {appeals.length === 0 ? (
              <div className="glass-panel p-12 rounded-3xl text-center text-slate-400 text-xs">
                No penalty appeals submitted for review.
              </div>
            ) : (
              <div className="space-y-4">
                {appeals.map((a) => (
                  <div key={a.id} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="font-bold text-sm text-white">{a.studentName}</span>
                        <span className="text-xs text-slate-400 ml-2">({a.studentId} • {a.studentEmail})</span>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                          a.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-300"
                            : a.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        Status: {a.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <div><span className="text-slate-500 font-semibold">Penalty Reason:</span> {a.penaltyReason} (-{a.creditPointsDeducted} pts)</div>
                      <div><span className="text-slate-500 font-semibold">Student Explanation:</span> "{a.appealReason}"</div>
                    </div>

                    {a.status === "PENDING" && (
                      <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
                        <input
                          type="text"
                          placeholder="Admin review comment / note..."
                          value={selectedAppeal?.id === a.id ? adminComment : ""}
                          onChange={(e) => {
                            setSelectedAppeal(a);
                            setAdminComment(e.target.value);
                          }}
                          className="bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl w-full sm:w-80 focus:outline-none"
                        />
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleReviewAppeal(a.id, "APPROVED")}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex-1 sm:flex-none shadow"
                          >
                            Approve (Restore Score)
                          </button>
                          <button
                            onClick={() => handleReviewAppeal(a.id, "REJECTED")}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex-1 sm:flex-none shadow"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: DATA ANALYTICS */}
        {activeTab === "analytics" && (
          <div className="space-y-8">
            {/* Rule-Based Suggestion Banner */}
            {recommendation && (
              <div className="p-4 bg-blue-950/40 border border-blue-500/40 rounded-2xl flex items-center gap-3 text-xs text-blue-200">
                <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold text-sm text-blue-100 block">Rule-Based Capacity Suggestion</span>
                  {recommendation}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Utilization Rate Chart */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white">Route Seat Utilization Rate (%)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={utilizationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="routeName" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="utilizationRate" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* No-Show Rate Chart */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white">No-Show Rate (%) per Route</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={noShowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="routeName" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="noShowRate" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE BUS MODAL */}
      {showBusModal && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add New Bus to Fleet</h2>
            <form onSubmit={handleCreateBus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Plate Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TAR-1004"
                  value={newBus.plateNumber}
                  onChange={(e) => setNewBus({ ...newBus, plateNumber: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Capacity (Seats)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newBus.capacity}
                  onChange={(e) => setNewBus({ ...newBus, capacity: parseInt(e.target.value) || 20 })}
                  className="input-field"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowBusModal(false)} className="btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Create Bus</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROUTE MODAL */}
      {showRouteModal && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add New Route</h2>
            <form onSubmit={handleCreateRoute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Route Name</label>
                <input
                  type="text"
                  required
                  placeholder="Route X: Main Gate &lt;-&gt; Destination"
                  value={newRoute.name}
                  onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Stops (Comma Separated)</label>
                <input
                  type="text"
                  required
                  placeholder="Main Gate, Block A, Block D, Terminal"
                  value={newRoute.stopsInput}
                  onChange={(e) => setNewRoute({ ...newRoute, stopsInput: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRouteModal(false)} className="btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Create Route</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE TRIP MODAL */}
      {showTripModal && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Schedule New Trip</h2>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              {[
                { label: "Route", key: "routeId", opts: routes.map((r: any) => ({ v: r.id, l: r.name })), ph: "Select Route", req: true },
                { label: "Bus", key: "busId", opts: buses.map((b: any) => ({ v: b.id, l: `${b.plateNumber} (${b.capacity} seats)` })), ph: "Select Bus", req: true },
                { label: "Driver", key: "driverId", opts: drivers.map((d: any) => ({ v: d.id, l: `${d.name} (${d.email})` })), ph: "Assign Driver (Optional)", req: false },
              ].map(({ label, key, opts, ph, req }) => (
                <div key={key}>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
                  <select
                    required={req}
                    value={(newTrip as any)[key]}
                    onChange={(e) => setNewTrip({ ...newTrip, [key]: e.target.value })}
                    className="input-field"
                  >
                    <option value="">{ph}</option>
                    {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Departure Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newTrip.departureTime}
                  onChange={(e) => setNewTrip({ ...newTrip, departureTime: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Est. Arrival Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newTrip.estimatedArrivalTime}
                  onChange={(e) => setNewTrip({ ...newTrip, estimatedArrivalTime: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTripModal(false)} className="btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Schedule Trip</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
