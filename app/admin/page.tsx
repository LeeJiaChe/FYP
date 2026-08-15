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
import StopsTab from "@/components/admin/StopsTab";
import DriversTab from "@/components/admin/DriversTab";
import AppealsTab from "@/components/admin/AppealsTab";
import AnalyticsTab from "@/components/admin/AnalyticsTab";

import {
  Activity,
  Bus,
  MapPin,
  Calendar,
  CreditCard,
  BarChart3,
  UserRound,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { trips, fetchTrips } = useTrips();
  const [activeTab, setActiveTab] = useState<
    "live" | "stops" | "buses" | "routes" | "trips" | "drivers" | "appeals" | "analytics"
  >("live");

  // Realtime Live Seat Monitoring state
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [liveTripDetails, setLiveTripDetails] = useState<any>(null);

  // CRUD Data State
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
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
    seatedCapacity: 20,
    standingCapacity: 8,
    status: "ACTIVE",
  });

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [newRoute, setNewRoute] = useState({
    name: "",
    routeStops: [
      { stopId: "", travelDurationToNextMinutes: 10 },
      { stopId: "", travelDurationToNextMinutes: null as number | null },
    ],
  });

  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [newTrip, setNewTrip] = useState({
    routeId: "",
    busId: "",
    driverId: "",
    departureTime: "",
  });

  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [adminComment, setAdminComment] = useState("");

  useEffect(() => {
    fetchBuses();
    fetchRoutes();
    fetchStops();
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

    let socket: ReturnType<typeof io> | null = null;
    let disposed = false;
    void fetch("/api/realtime/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId: selectedTripId }),
    }).then(async (response) => {
      if (!response.ok || disposed) return;
      const subscription = await response.json();
      if (disposed) return;
      const socketUrl =
        process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
      socket = io(socketUrl, { auth: { token: subscription.token } });
      socket.on("connect", () => fetchTripDetails(selectedTripId));
      socket.on("occupancy.changed", () => fetchTripDetails(selectedTripId));
      socket.on("trip.changed", () => fetchTripDetails(selectedTripId));
      socket.on("location.changed", () => fetchTripDetails(selectedTripId));
    });

    return () => {
      disposed = true;
      socket?.disconnect();
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

  async function fetchStops() {
    try {
      const res = await fetch("/api/admin/stops");
      if (res.ok) {
        const data = await res.json();
        setStops(data.stops || []);
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
        setNewBus({ plateNumber: "", seatedCapacity: 20, standingCapacity: 8, status: "ACTIVE" });
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
    try {
      const res = await fetch("/api/admin/routes", {
        method: editingRouteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingRouteId ? { id: editingRouteId } : {}), name: newRoute.name, stops: newRoute.routeStops }),
      });

      if (res.ok) {
        toast.success(editingRouteId ? "Route updated; existing Trip snapshots are unchanged" : "Route created successfully");
        setShowRouteModal(false);
        setEditingRouteId(null);
        setNewRoute({
          name: "",
          routeStops: [
            { stopId: "", travelDurationToNextMinutes: 10 },
            { stopId: "", travelDurationToNextMinutes: null },
          ],
        });
        fetchRoutes();
      } else {
        const data = await res.json();
        toast.error(data.error?.message || data.error || "Failed to create route");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }

    async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = editingTripId ? {
        driverId: newTrip.driverId || null,
        departureTime: newTrip.departureTime
          ? new Date(newTrip.departureTime).toISOString()
          : "",
      } : {
        ...newTrip,
        driverId: newTrip.driverId || undefined,
        departureTime: newTrip.departureTime ? new Date(newTrip.departureTime).toISOString() : "",
      };

      const res = await fetch(editingTripId ? `/api/trips/${editingTripId}` : "/api/trips", {
        method: editingTripId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingTripId ? "Trip schedule updated" : "Trip scheduled successfully");
        setShowTripModal(false);
        setEditingTripId(null);
        setNewTrip({
          routeId: "",
          busId: "",
          driverId: "",
          departureTime: "",
        });
        fetchTrips();
      } else {
        const errData = await res.json();
        toast.error(`Failed to schedule trip: ${errData.error?.message || errData.error || res.status}`);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }

  async function mutateSimple(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || data.error || "Operation failed");
    return data;
  }

  async function handleCreateStop(existing?: any) {
    const code = window.prompt("Stable stop code", existing?.code ?? "");
    if (code === null) return;
    const name = window.prompt("Display name", existing?.name ?? "");
    if (name === null) return;
    const latitude = Number(window.prompt("Latitude (-90 to 90)", String(existing?.latitude ?? "3.215")));
    const longitude = Number(window.prompt("Longitude (-180 to 180)", String(existing?.longitude ?? "101.728")));
    try {
      await mutateSimple("/api/admin/stops", existing ? "PATCH" : "POST", { ...(existing ? { id: existing.id } : {}), code, name, latitude, longitude });
      toast.success(existing ? "Stop updated" : "Stop created");
      fetchStops();
    } catch (error: any) { toast.error(error.message); }
  }

  async function handleDeactivateStop(stop: any) {
    if (!window.confirm(`Deactivate ${stop.code}? Historical Trip snapshots remain readable.`)) return;
    try { await mutateSimple(`/api/admin/stops?id=${stop.id}`, "DELETE"); toast.success("Stop deactivated"); fetchStops(); fetchRoutes(); }
    catch (error: any) { toast.error(error.message); }
  }

  async function handleDeactivateRoute(route: any) {
    if (!window.confirm(`Deactivate ${route.name}? Existing Trips are not rewritten.`)) return;
    try { await mutateSimple(`/api/admin/routes?id=${route.id}`, "DELETE"); toast.success("Route deactivated"); fetchRoutes(); }
    catch (error: any) { toast.error(error.message); }
  }

  async function handleRetireBus(bus: any) {
    if (!window.confirm(`Retire ${bus.plateNumber}? Future NOT_STARTED Trips will be cancelled.`)) return;
    try { await mutateSimple(`/api/admin/buses?id=${bus.id}`, "DELETE"); toast.success("Bus retired"); fetchBuses(); fetchTrips(); }
    catch (error: any) { toast.error(error.message); }
  }

  async function handleDriver(existing?: any) {
    const name = window.prompt("Driver name", existing?.name ?? "");
    if (name === null) return;
    const email = window.prompt("Driver email", existing?.email ?? "");
    if (email === null) return;
    const password = existing ? undefined : window.prompt("Temporary password (8+ chars, upper/lower/number)");
    if (!existing && password === null) return;
    try {
      await mutateSimple("/api/admin/drivers", existing ? "PATCH" : "POST", { ...(existing ? { id: existing.id } : { password }), name, email });
      toast.success(existing ? "Driver updated" : "Driver created"); fetchDrivers();
    } catch (error: any) { toast.error(error.message); }
  }

  async function handleCancelTrip(trip: any) {
    const reason = window.prompt("Cancellation reason (required)");
    if (!reason) return;
    try { await mutateSimple(`/api/trips/${trip.id}`, "DELETE", { reason }); toast.success("Trip cancelled"); fetchTrips(); }
    catch (error: any) { toast.error(error.message); }
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
                "stops",
                "buses",
                "routes",
                "trips",
                "drivers",
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
                stops: <MapPin className="w-4 h-4" />,
                routes: <MapPin className="w-4 h-4" />,
                trips: <Calendar className="w-4 h-4" />,
                drivers: <UserRound className="w-4 h-4" />,
                appeals: <CreditCard className="w-4 h-4" />,
                analytics: <BarChart3 className="w-4 h-4" />,
              };
              const labels: Record<string, string> = {
                live: "Live Fleet",
                buses: "Buses",
                stops: "Stops",
                routes: "Routes",
                trips: "Timetable",
                drivers: "Drivers",
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
          <BusesTab buses={buses} onOpenModal={() => { setEditingBusId(null); setNewBus({ plateNumber: "", seatedCapacity: 20, standingCapacity: 8, status: "ACTIVE" }); setShowBusModal(true); }} onEditBus={(bus) => { setEditingBusId(bus.id); setNewBus({ plateNumber: bus.plateNumber, seatedCapacity: bus.seatedCapacity, standingCapacity: bus.standingCapacity, status: bus.status }); setShowBusModal(true); }} onRetireBus={handleRetireBus} />
        )}

        {activeTab === "stops" && <StopsTab stops={stops} onCreate={() => handleCreateStop()} onEdit={handleCreateStop} onDeactivate={handleDeactivateStop} />}

        {/* TAB 3: ROUTES CRUD */}
        {activeTab === "routes" && (
          <RoutesTab
            routes={routes}
            onOpenModal={() => { setEditingRouteId(null); setNewRoute({ name: "", routeStops: [{ stopId: "", travelDurationToNextMinutes: 10 }, { stopId: "", travelDurationToNextMinutes: null }] }); setShowRouteModal(true); }}
            onEditRoute={(route) => { setEditingRouteId(route.id); setNewRoute({ name: route.name, routeStops: route.routeStops.map((item: any) => ({ stopId: item.stop.id, travelDurationToNextMinutes: item.travelDurationToNextMinutes })) }); setShowRouteModal(true); }}
            onDeactivateRoute={handleDeactivateRoute}
          />
        )}

        {/* TAB 4: TIMETABLE & TRIPS */}
        {activeTab === "trips" && (
          <TripsTab trips={trips} onOpenModal={() => { setEditingTripId(null); setNewTrip({ routeId: "", busId: "", driverId: "", departureTime: "" }); setShowTripModal(true); }} onEditTrip={(trip) => { setEditingTripId(trip.id); setNewTrip({ routeId: trip.routeId, busId: trip.busId, driverId: trip.driverId || "", departureTime: new Date(trip.departureTime).toISOString().slice(0, 16) }); setShowTripModal(true); }} onCancelTrip={handleCancelTrip} />
        )}

        {activeTab === "drivers" && <DriversTab drivers={drivers} onCreate={() => handleDriver()} onEdit={handleDriver} />}

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
              {editingBusId && (
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Fleet Status</label>
                  <select value={newBus.status} onChange={(e) => setNewBus({ ...newBus, status: e.target.value })} className="input-field">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Maintenance or retirement cancels future NOT_STARTED Trips through the central cancellation workflow.</p>
                </div>
              )}
              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Seated Capacity
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newBus.seatedCapacity}
                  onChange={(e) =>
                    setNewBus({
                      ...newBus,
                      seatedCapacity: parseInt(e.target.value) || 20,
                    })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Standing Capacity
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={newBus.standingCapacity}
                  onChange={(e) =>
                    setNewBus({
                      ...newBus,
                      standingCapacity: Math.max(0, parseInt(e.target.value) || 0),
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
                  {editingBusId ? "Save Bus" : "Create Bus"}
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
              {editingRouteId ? "Edit Route" : "Add New Route"}
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
                  Ordered Stops and Travel Time to Next Stop
                </label>
                <div className="space-y-2">
                  {newRoute.routeStops.map((routeStop, index) => (
                    <div key={index} className="grid grid-cols-[1fr_8rem] gap-2">
                      <select
                        required
                        value={routeStop.stopId}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          routeStops: newRoute.routeStops.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, stopId: e.target.value } : item
                          ),
                        })}
                        className="input-field"
                      >
                        <option value="">Select stop</option>
                        {stops.map((stop) => (
                          <option key={stop.id} value={stop.id}>{stop.code} — {stop.name}</option>
                        ))}
                      </select>
                      {index < newRoute.routeStops.length - 1 ? (
                        <input
                          type="number"
                          min={1}
                          required
                          aria-label={`Travel minutes from stop ${index + 1}`}
                          value={routeStop.travelDurationToNextMinutes ?? 1}
                          onChange={(e) => setNewRoute({
                            ...newRoute,
                            routeStops: newRoute.routeStops.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, travelDurationToNextMinutes: Math.max(1, parseInt(e.target.value) || 1) }
                                : item
                            ),
                          })}
                          className="input-field"
                          title="Minutes to next stop"
                        />
                      ) : (
                        <div className="input-field text-xs flex items-center">Final stop</div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={newRoute.routeStops.length >= 5}
                      onClick={() => setNewRoute({
                        ...newRoute,
                        routeStops: [
                          ...newRoute.routeStops.slice(0, -1).map((item) => ({
                            ...item,
                            travelDurationToNextMinutes: item.travelDurationToNextMinutes ?? 10,
                          })),
                          {
                            ...newRoute.routeStops[newRoute.routeStops.length - 1],
                            travelDurationToNextMinutes: 10,
                          },
                          { stopId: "", travelDurationToNextMinutes: null },
                        ],
                      })}
                      className="btn-ghost text-xs"
                    >
                      Add Stop
                    </button>
                    <button
                      type="button"
                      disabled={newRoute.routeStops.length <= 2}
                      onClick={() => setNewRoute({
                        ...newRoute,
                        routeStops: newRoute.routeStops.slice(0, -1).map((item, itemIndex, items) => ({
                          ...item,
                          travelDurationToNextMinutes: itemIndex === items.length - 1 ? null : item.travelDurationToNextMinutes,
                        })),
                      })}
                      className="btn-ghost text-xs"
                    >
                      Remove Last
                    </button>
                  </div>
                </div>
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
                  {editingRouteId ? "Save Route" : "Create Route"}
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
              {editingTripId ? "Reschedule / Reassign Trip" : "Schedule New Trip"}
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
                  opts: buses.filter((b: any) => b.status === "ACTIVE").map((b: any) => ({
                    v: b.id,
                    l: `${b.plateNumber} (${b.seatedCapacity} seated, ${b.standingCapacity} standing)`,
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
                    disabled={Boolean(editingTripId && (key === "routeId" || key === "busId"))}
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

              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Intermediate and final times are derived from the Route travel-time offsets.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  {editingTripId ? "Save Schedule" : "Schedule Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
