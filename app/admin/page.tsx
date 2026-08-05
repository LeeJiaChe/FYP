"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import io from "socket.io-client";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useTrips } from "@/hooks/useTrips";
import LiveMonitoringTab from "@/components/admin/LiveMonitoringTab";
import BusesTab from "@/components/admin/BusesTab";
import RoutesTab from "@/components/admin/RoutesTab";
import TripsTab from "@/components/admin/TripsTab";
import AppealsTab from "@/components/admin/AppealsTab";
import AnalyticsTab from "@/components/admin/AnalyticsTab";

import {
  Activity,
  Bus,
  MapPin,
  Calendar,
  CreditCard,
  BarChart3,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { trips, fetchTrips } = useTrips();
  const [activeTab, setActiveTab] = useState<
    "live" | "buses" | "routes" | "trips" | "appeals" | "analytics"
  >("live");

  // Realtime Live Seat Monitoring state
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
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newBus, setNewBus] = useState({
    plateNumber: "",
    capacity: 20,
    status: "ACTIVE",
  });

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
    fetchBuses();
    fetchRoutes();
    fetchDrivers();
    fetchAppeals();
  }, []);

  useEffect(() => {
    if (activeTab === "analytics" && utilizationData.length === 0) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (trips.length > 0 && !selectedTripId) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  useEffect(() => {
    if (!selectedTripId) return;

    fetchTripDetails(selectedTripId);

    const socketUrl =
      process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.emit("join-trip", selectedTripId);

    socket.on("seat-update", () => {
      fetchTripDetails(selectedTripId);
    });

    socket.on("trip-update", () => {
      fetchTripDetails(selectedTripId);
    });

    return () => {
      socket.emit("leave-trip", selectedTripId);
      socket.disconnect();
    };
  }, [selectedTripId]);

  async function fetchTripDetails(tripId: string) {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setLiveTripDetails(data.trip);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function fetchBuses() {
    try {
      const res = await fetch("/api/admin/buses");
      if (res.ok) {
        const data = await res.json();
        setBuses(data.buses || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/admin/routes");
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function fetchDrivers() {
    try {
      const res = await fetch("/api/admin/drivers-list");
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function fetchAppeals() {
    try {
      const res = await fetch("/api/appeals");
      if (res.ok) {
        const data = await res.json();
        setAppeals(data.appeals || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
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
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

    async function handleCreateBus(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/buses", {
        method: editingBusId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingBusId ? { id: editingBusId, ...newBus } : newBus),
      });

      if (res.ok) {
        toast.success(editingBusId ? "Bus updated successfully" : "Bus created successfully");
        setShowBusModal(false);
        setEditingBusId(null);
        setNewBus({ plateNumber: "", capacity: 20, status: "ACTIVE" });
        fetchBuses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save bus");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }

    async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    const stops = newRoute.stopsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoute.name, stops }),
      });

      if (res.ok) {
        toast.success("Route created successfully");
        setShowRouteModal(false);
        setNewRoute({ name: "", stopsInput: "" });
        fetchRoutes();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create route");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }

    async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...newTrip,
        driverId: newTrip.driverId || undefined,
        departureTime: newTrip.departureTime
          ? new Date(newTrip.departureTime).toISOString()
          : "",
        estimatedArrivalTime: newTrip.estimatedArrivalTime
          ? new Date(newTrip.estimatedArrivalTime).toISOString()
          : "",
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Trip scheduled successfully");
        setShowTripModal(false);
        setNewTrip({
          routeId: "",
          busId: "",
          driverId: "",
          departureTime: "",
          estimatedArrivalTime: "",
        });
        fetchTrips();
      } else {
        const errData = await res.json();
        toast.error(`Failed to schedule trip: ${errData.error || res.status}`);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }


    async function handleReviewAppeal(
    appealId: string,
    status: "APPROVED" | "REJECTED"
  ) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/appeals/${appealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminComment }),
      });

      if (res.ok) {
        toast.success(`Appeal ${status.toLowerCase()} successfully`);
        setSelectedAppeal(null);
        setAdminComment("");
        fetchAppeals();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to process appeal");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--bg-base)",
        color: "var(--text-primary)",
      }}
    >
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Admin Navigation Tabs */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="tab-bar">
            {(
              [
                "live",
                "buses",
                "routes",
                "trips",
                "appeals",
                "analytics",
              ] as const
            ).map((tab) => {
              const icons: Record<string, React.ReactNode> = {
                live: (
                  <Activity
                    className="w-4 h-4 live-dot"
                    style={{ color: "#4ade80" }}
                  />
                ),
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
                  {tab === "appeals" &&
                    appeals.filter((a) => a.status === "PENDING").length >
                      0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={
                          activeTab === "appeals"
                            ? { background: "rgba(255,255,255,0.25)" }
                            : { background: "#f59e0b", color: "#1a1a1a" }
                        }
                      >
                        {
                          appeals.filter((a) => a.status === "PENDING").length
                        }
                      </span>
                    )}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: LIVE FLEET */}
        {activeTab === "live" && (
          <LiveMonitoringTab
            trips={trips}
            selectedTripId={selectedTripId}
            setSelectedTripId={setSelectedTripId}
            liveTripDetails={liveTripDetails}
            onRefresh={() => fetchTripDetails(selectedTripId || "")}
          />
        )}

        {/* TAB 2: BUSES CRUD */}
        {activeTab === "buses" && (
          <BusesTab buses={buses} onOpenModal={() => { setEditingBusId(null); setNewBus({ plateNumber: "", capacity: 20, status: "ACTIVE" }); setShowBusModal(true); }} onEditBus={(bus) => { setEditingBusId(bus.id); setNewBus({ plateNumber: bus.plateNumber, capacity: bus.capacity, status: bus.status }); setShowBusModal(true); }} />
        )}

        {/* TAB 3: ROUTES CRUD */}
        {activeTab === "routes" && (
          <RoutesTab
            routes={routes}
            onOpenModal={() => setShowRouteModal(true)}
          />
        )}

        {/* TAB 4: TIMETABLE & TRIPS */}
        {activeTab === "trips" && (
          <TripsTab trips={trips} onOpenModal={() => setShowTripModal(true)} />
        )}

        {/* TAB 5: PENALTY APPEALS */}
        {activeTab === "appeals" && (
          <AppealsTab
            appeals={appeals}
            selectedAppeal={selectedAppeal}
            setSelectedAppeal={setSelectedAppeal}
            adminComment={adminComment}
            setAdminComment={setAdminComment}
            onReviewAppeal={handleReviewAppeal}
          />
        )}

        {/* TAB 6: DATA ANALYTICS */}
        {activeTab === "analytics" && (
          <AnalyticsTab
            recommendation={recommendation}
            utilizationData={utilizationData}
            noShowData={noShowData}
          />
        )}
      </main>

      {/* CREATE BUS MODAL */}
      {showBusModal && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-md p-6 space-y-4">
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {editingBusId ? "Edit Bus" : "Add New Bus to Fleet"}
            </h2>
            <form onSubmit={handleCreateBus} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Plate Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TAR-1004"
                  value={newBus.plateNumber}
                  onChange={(e) =>
                    setNewBus({ ...newBus, plateNumber: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Capacity (Seats)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newBus.capacity}
                  onChange={(e) =>
                    setNewBus({
                      ...newBus,
                      capacity: parseInt(e.target.value) || 20,
                    })
                  }
                  className="input-field"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBusModal(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Create Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROUTE MODAL */}
      {showRouteModal && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-md p-6 space-y-4">
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Add New Route
            </h2>
            <form onSubmit={handleCreateRoute} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Route Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Route X: Main Gate <-> Destination"
                  value={newRoute.name}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, name: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Stops (Comma Separated)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Main Gate, Block A, Block D, Terminal"
                  value={newRoute.stopsInput}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, stopsInput: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRouteModal(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Create Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE TRIP MODAL */}
      {showTripModal && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-md p-6 space-y-4">
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Schedule New Trip
            </h2>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              {[
                {
                  label: "Route",
                  key: "routeId",
                  opts: routes.map((r: any) => ({ v: r.id, l: r.name })),
                  ph: "Select Route",
                  req: true,
                },
                {
                  label: "Bus",
                  key: "busId",
                  opts: buses.map((b: any) => ({
                    v: b.id,
                    l: `${b.plateNumber} (${b.capacity} seats)`,
                  })),
                  ph: "Select Bus",
                  req: true,
                },
                {
                  label: "Driver",
                  key: "driverId",
                  opts: drivers.map((d: any) => ({
                    v: d.id,
                    l: `${d.name} (${d.email})`,
                  })),
                  ph: "Assign Driver (Optional)",
                  req: false,
                },
              ].map(({ label, key, opts, ph, req }) => (
                <div key={key}>
                  <label
                    className="block text-xs font-bold mb-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {label}
                  </label>
                  <select
                    required={req}
                    value={(newTrip as any)[key]}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, [key]: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="">{ph}</option>
                    {opts.map((o: any) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Departure Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newTrip.departureTime}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, departureTime: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Est. Arrival Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newTrip.estimatedArrivalTime}
                  onChange={(e) =>
                    setNewTrip({
                      ...newTrip,
                      estimatedArrivalTime: e.target.value,
                    })
                  }
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Schedule Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
