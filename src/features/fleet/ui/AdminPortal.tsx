"use client";

import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import io from "socket.io-client";
import Navbar from "@/components/Navbar";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { DriversTab, useCurrentUser } from "@/features/identity/ui";
import { TripsTab, useTrips } from "@/features/trips/ui";
import { LiveMonitoringTab } from "@/features/location/ui";
import BusesTab from "@/features/fleet/ui/BusesTab";
import RoutesTab from "@/features/fleet/ui/RoutesTab";
import StopsTab from "@/features/fleet/ui/StopsTab";
import { AppealsTab } from "@/features/penalties/ui";
import { AnalyticsTab } from "@/features/analytics/ui";
import type { CurrentUser } from "@/shared/ui/current-user";

import {
  Activity,
  LayoutDashboard,
  Bus,
  MapPin,
  Calendar,
  CreditCard,
  BarChart3,
  UserRound,
  Menu,
  Route as RouteIcon,
  X,
} from "lucide-react";

type AdminView =
  | "dashboard"
  | "live"
  | "stops"
  | "buses"
  | "routes"
  | "trips"
  | "drivers"
  | "appeals"
  | "analytics";

export default function AdminPortal({
  initialUser,
}: {
  initialUser: CurrentUser;
}) {
  const { user } = useCurrentUser(initialUser);
  const { trips, fetchTrips } = useTrips();
  const [activeTab, setActiveTab] = useState<AdminView>("dashboard");
  const [adminNavOpen, setAdminNavOpen] = useState(false);
  const adminMenuButtonRef = useRef<HTMLButtonElement>(null);
  const adminSidebarRef = useRef<HTMLElement>(null);

  // Realtime Live Seat Monitoring state
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const activeTripId = selectedTripId ?? trips[0]?.id ?? null;
  const [liveTripDetails, setLiveTripDetails] = useState<any>(null);

  // CRUD Data State
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [serviceBlocks, setServiceBlocks] = useState<any[]>([]);
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
    lineId: "",
    direction: "OUTBOUND" as "OUTBOUND" | "INBOUND",
    name: "",
    routeStops: [
      { stopId: "", travelDurationToNextMinutes: 10 },
      { stopId: "", travelDurationToNextMinutes: null as number | null },
    ],
  });

  const [showTripModal, setShowTripModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [newTrip, setNewTrip] = useState({
    lineId: "",
    routeId: "",
    busId: "",
    driverId: "",
    blockId: "",
    departureTime: "",
  });
  const [newBlock, setNewBlock] = useState({
    code: "",
    serviceDate: "",
    busId: "",
  });

  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [adminComment, setAdminComment] = useState("");
  const [stopForm, setStopForm] = useState<any | null>(null);
  const [driverForm, setDriverForm] = useState<any | null>(null);
  const [destructiveTarget, setDestructiveTarget] = useState<{
    kind: "stop" | "route" | "bus";
    item: any;
  } | null>(null);
  const [cancelTripTarget, setCancelTripTarget] = useState<any | null>(null);
  const [cancelTripReason, setCancelTripReason] = useState("");

  useEffect(() => {
    fetchBuses();
    fetchRoutes();
    fetchLines();
    fetchServiceBlocks();
    fetchStops();
    fetchDrivers();
    fetchAppeals();
  }, []);

  useEffect(() => {
    if (!showBusModal && !showRouteModal && !showTripModal && !showBlockModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowBusModal(false);
      setShowRouteModal(false);
      setShowTripModal(false);
      setShowBlockModal(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showBlockModal, showBusModal, showRouteModal, showTripModal]);

  useEffect(() => {
    if (!adminNavOpen) return;
    const menuButton = adminMenuButtonRef.current;
    const closeNavigation = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAdminNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const sidebar = adminSidebarRef.current;
      if (!sidebar) return;
      const items = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    adminSidebarRef.current?.querySelector<HTMLElement>("button")?.focus();
    document.addEventListener("keydown", closeNavigation);
    return () => {
      document.removeEventListener("keydown", closeNavigation);
      menuButton?.focus();
    };
  }, [adminNavOpen]);

  useEffect(() => {
    if (activeTab === "analytics" && utilizationData.length === 0) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!activeTripId) return;

    const initialFetch = window.setTimeout(
      () => void fetchTripDetails(activeTripId),
      0,
    );

    let socket: ReturnType<typeof io> | null = null;
    let disposed = false;
    void fetch("/api/realtime/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId: activeTripId }),
    }).then(async (response) => {
      if (!response.ok || disposed) return;
      const subscription = await response.json();
      if (disposed) return;
      const socketUrl =
        process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
      socket = io(socketUrl, { auth: { token: subscription.token } });
      socket.on("connect", () => fetchTripDetails(activeTripId));
      socket.on("occupancy.changed", () => fetchTripDetails(activeTripId));
      socket.on("trip.changed", () => fetchTripDetails(activeTripId));
      socket.on("location.changed", () => fetchTripDetails(activeTripId));
    });

    return () => {
      disposed = true;
      window.clearTimeout(initialFetch);
      socket?.disconnect();
    };
  }, [activeTripId]);

  async function fetchTripDetails(tripId: string) {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setLiveTripDetails(data.trip);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchBuses() {
    try {
      const res = await fetch("/api/admin/buses");
      if (res.ok) {
        const data = await res.json();
        setBuses(data.buses || []);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/admin/routes");
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchLines() {
    try {
      const res = await fetch("/api/admin/lines");
      if (res.ok) setLines((await res.json()).lines || []);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchServiceBlocks() {
    try {
      const res = await fetch("/api/admin/service-blocks");
      if (res.ok) setServiceBlocks((await res.json()).serviceBlocks || []);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchStops() {
    try {
      const res = await fetch("/api/admin/stops");
      if (res.ok) {
        const data = await res.json();
        setStops(data.stops || []);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchDrivers() {
    try {
      const res = await fetch("/api/admin/drivers-list");
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchAppeals() {
    try {
      const res = await fetch("/api/appeals");
      if (res.ok) {
        const data = await res.json();
        const nextAppeals = data.appeals || [];
        setAppeals(nextAppeals);
        setSelectedAppeal((current: any) =>
          current
            ? (nextAppeals.find((appeal: any) => appeal.id === current.id) ??
              null)
            : null,
        );
        return nextAppeals;
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
    return null;
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
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  }

  async function handleCreateBus(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/buses", {
        method: editingBusId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingBusId ? { id: editingBusId, ...newBus } : newBus,
        ),
      });

      if (res.ok) {
        toast.success(
          editingBusId
            ? "Bus updated successfully"
            : "Bus created successfully",
        );
        setShowBusModal(false);
        setEditingBusId(null);
        setNewBus({
          plateNumber: "",
          seatedCapacity: 20,
          standingCapacity: 8,
          status: "ACTIVE",
        });
        fetchBuses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save bus");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/routes", {
        method: editingRouteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingRouteId ? { id: editingRouteId } : {}),
          lineId: newRoute.lineId,
          direction: newRoute.direction,
          name: newRoute.name,
          stops: newRoute.routeStops,
        }),
      });

      if (res.ok) {
        toast.success(
          editingRouteId
            ? "Route updated; existing Trip snapshots are unchanged"
            : "Route created successfully",
        );
        setShowRouteModal(false);
        setEditingRouteId(null);
        setNewRoute({
          lineId: "",
          direction: "OUTBOUND",
          name: "",
          routeStops: [
            { stopId: "", travelDurationToNextMinutes: 10 },
            { stopId: "", travelDurationToNextMinutes: null },
          ],
        });
        fetchRoutes();
      } else {
        const data = await res.json();
        toast.error(
          data.error?.message || data.error || "Failed to create route",
        );
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = editingTripId
        ? {
            driverId: newTrip.driverId || null,
            departureTime: newTrip.departureTime
              ? new Date(newTrip.departureTime).toISOString()
              : "",
          }
        : {
            routeId: newTrip.routeId,
            busId: newTrip.busId,
            driverId: newTrip.driverId || undefined,
            blockId: newTrip.blockId || undefined,
            departureTime: newTrip.departureTime
              ? new Date(newTrip.departureTime).toISOString()
              : "",
          };

      const res = await fetch(
        editingTripId ? `/api/trips/${editingTripId}` : "/api/trips",
        {
          method: editingTripId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        toast.success(
          editingTripId
            ? "Trip schedule updated"
            : "Trip scheduled successfully",
        );
        setShowTripModal(false);
        setEditingTripId(null);
        setNewTrip({
          lineId: "",
          routeId: "",
          busId: "",
          driverId: "",
          blockId: "",
          departureTime: "",
        });
        await Promise.all([fetchTrips(), fetchServiceBlocks()]);
      } else {
        const errData = await res.json();
        toast.error(
          `Failed to schedule trip: ${errData.error?.message || errData.error || res.status}`,
        );
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateBlock(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await mutateSimple("/api/admin/service-blocks", "POST", newBlock);
      toast.success("ServiceBlock created");
      setShowBlockModal(false);
      setNewBlock({ code: "", serviceDate: "", busId: "" });
      await fetchServiceBlocks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create ServiceBlock");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutateSimple(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error?.message || data.error || "Operation failed");
    return data;
  }

  function handleCreateStop(existing?: any) {
    setStopForm({
      id: existing?.id,
      code: existing?.code ?? "",
      name: existing?.name ?? "",
      latitude: String(existing?.latitude ?? "3.215"),
      longitude: String(existing?.longitude ?? "101.728"),
    });
  }

  async function submitStop(event: React.FormEvent) {
    event.preventDefault();
    if (!stopForm) return;
    try {
      setIsSubmitting(true);
      await mutateSimple("/api/admin/stops", stopForm.id ? "PATCH" : "POST", {
        ...(stopForm.id ? { id: stopForm.id } : {}),
        code: stopForm.code,
        name: stopForm.name,
        latitude: Number(stopForm.latitude),
        longitude: Number(stopForm.longitude),
      });
      toast.success(stopForm.id ? "Stop updated" : "Stop created");
      setStopForm(null);
      fetchStops();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDeactivateStop(stop: any) {
    setDestructiveTarget({ kind: "stop", item: stop });
  }

  function handleDeactivateRoute(route: any) {
    setDestructiveTarget({ kind: "route", item: route });
  }

  function handleRetireBus(bus: any) {
    setDestructiveTarget({ kind: "bus", item: bus });
  }

  function handleDriver(existing?: any) {
    setDriverForm({
      id: existing?.id,
      name: existing?.name ?? "",
      email: existing?.email ?? "",
      password: "",
    });
  }

  async function submitDriver(event: React.FormEvent) {
    event.preventDefault();
    if (!driverForm) return;
    try {
      setIsSubmitting(true);
      await mutateSimple(
        "/api/admin/drivers",
        driverForm.id ? "PATCH" : "POST",
        {
          ...(driverForm.id
            ? { id: driverForm.id }
            : { password: driverForm.password }),
          name: driverForm.name,
          email: driverForm.email,
        },
      );
      toast.success(driverForm.id ? "Driver updated" : "Driver created");
      setDriverForm(null);
      fetchDrivers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelTrip(trip: any) {
    setCancelTripReason("");
    setCancelTripTarget(trip);
  }

  async function confirmDestructive() {
    if (!destructiveTarget) return;
    const { kind, item } = destructiveTarget;
    try {
      if (kind === "stop") {
        await mutateSimple(`/api/admin/stops?id=${item.id}`, "DELETE");
        await Promise.all([fetchStops(), fetchRoutes()]);
        toast.success("Stop deactivated");
      }
      if (kind === "route") {
        await mutateSimple(`/api/admin/routes?id=${item.id}`, "DELETE");
        await fetchRoutes();
        toast.success("Route deactivated");
      }
      if (kind === "bus") {
        await mutateSimple(`/api/admin/buses?id=${item.id}`, "DELETE");
        await Promise.all([fetchBuses(), fetchTrips()]);
        toast.success("Bus retired");
      }
      setDestructiveTarget(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function submitCancelTrip(event: React.FormEvent) {
    event.preventDefault();
    if (!cancelTripTarget || !cancelTripReason.trim()) return;
    try {
      setIsSubmitting(true);
      await mutateSimple(`/api/trips/${cancelTripTarget.id}`, "DELETE", {
        reason: cancelTripReason.trim(),
      });
      toast.success("Trip cancelled");
      setCancelTripTarget(null);
      fetchTrips();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReviewAppeal(
    appealId: string,
    status: "APPROVED" | "REJECTED",
  ) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/appeals/${appealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminComment }),
      });

      if (res.ok) {
        const data = await res.json();
        const resolvedStatus = data.result.status;
        const resolvedAt = new Date().toISOString();
        setAppeals((current) =>
          current.map((appeal) =>
            appeal.id === appealId
              ? {
                  ...appeal,
                  status: resolvedStatus,
                  adminComment,
                  resolvedAt,
                  reviewedBy: user?.name ?? null,
                }
              : appeal,
          ),
        );
        setSelectedAppeal((current: any) =>
          current?.id === appealId
            ? {
                ...current,
                status: resolvedStatus,
                adminComment,
                resolvedAt,
                reviewedBy: user?.name ?? null,
              }
            : current,
        );
        toast.success(`Appeal ${resolvedStatus.toLowerCase()} successfully`);
        setAdminComment("");
        await fetchAppeals();
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to process appeal");
        await fetchAppeals();
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pendingAppeals = appeals.filter(
    (appeal) => appeal.status === "PENDING",
  ).length;
  const activeTrips = trips.filter(
    (trip) => trip.status === "BOARDING" || trip.status === "DEPARTED",
  );
  const upcomingTrips = trips.filter((trip) => trip.status === "NOT_STARTED");
  const attentionBuses = buses.filter((bus) => bus.status !== "ACTIVE");
  const adminNavigation: Array<{
    label: string;
    items: Array<{
      id: AdminView;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }>;
  }> = [
    {
      label: "Overview",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "live", label: "Live Operations", icon: Activity },
      ],
    },
    {
      label: "Operations",
      items: [
        { id: "trips", label: "Timetable", icon: Calendar },
        { id: "buses", label: "Buses", icon: Bus },
        { id: "routes", label: "Routes", icon: RouteIcon },
        { id: "stops", label: "Stops", icon: MapPin },
        { id: "drivers", label: "Drivers", icon: UserRound },
      ],
    },
    {
      label: "Passengers",
      items: [{ id: "appeals", label: "Appeals", icon: CreditCard }],
    },
    {
      label: "Insights",
      items: [{ id: "analytics", label: "Analytics", icon: BarChart3 }],
    },
  ];

  return (
    <div className="admin-shell">
      <Navbar initialUser={user} />
      <button
        ref={adminMenuButtonRef}
        type="button"
        onClick={() => setAdminNavOpen(true)}
        aria-expanded={adminNavOpen}
        aria-controls="admin-navigation-drawer"
        className="admin-mobile-menu"
      >
        <Menu aria-hidden className="size-5" /> Administration menu
      </button>
      <div className="admin-layout">
        {adminNavOpen && (
          <button
            type="button"
            className="admin-nav-scrim"
            aria-label="Close administration menu"
            onClick={() => setAdminNavOpen(false)}
          />
        )}
        <aside
          ref={adminSidebarRef}
          id="admin-navigation-drawer"
          aria-label="Administration navigation"
          className={`admin-sidebar ${adminNavOpen ? "open" : ""}`}
        >
          <div className="admin-sidebar-heading">
            <div>
              <p className="eyebrow">Operations</p>
              <strong>Administration</strong>
            </div>
            <button
              type="button"
              onClick={() => setAdminNavOpen(false)}
              aria-label="Close administration menu"
            >
              <X aria-hidden />
            </button>
          </div>
          <nav aria-label="Administration sections">
            {adminNavigation.map((group) => (
              <section key={group.label}>
                <h2>{group.label}</h2>
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => {
                      setActiveTab(id);
                      setAdminNavOpen(false);
                    }}
                    aria-current={activeTab === id ? "page" : undefined}
                    className={activeTab === id ? "active" : ""}
                  >
                    <Icon aria-hidden className="size-4" />
                    <span>{label}</span>
                    {id === "appeals" && pendingAppeals > 0 && (
                      <small>{pendingAppeals}</small>
                    )}
                  </button>
                ))}
              </section>
            ))}
          </nav>
        </aside>

        <main id="main-content" className="admin-content">
          {activeTab === "dashboard" && (
            <div className="admin-dashboard animate-fade-in">
              <header className="admin-dashboard-header">
                <div>
                  <h1>What requires attention now</h1>
                  <p>
                    Live Trip state, upcoming work and passenger review queues
                    from current system data.
                  </p>
                </div>
                <time>
                  {new Date().toLocaleDateString("en-MY", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </time>
              </header>
              <section className="admin-command-stage">
                <section className="operations-anchor">
                  <div className="dashboard-section-heading">
                    <div>
                      <h2>Active operations</h2>
                      <span
                        className={`operations-live-count ${activeTrips.length > 0 ? "is-live" : "is-quiet"}`}
                      >
                        <i />
                        {activeTrips.length} active
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setActiveTab("live")}
                    >
                      Open Live Operations
                    </button>
                  </div>
                  {activeTrips.length === 0 ? (
                    <p className="dashboard-empty">
                      No Trips are boarding or departed right now.
                    </p>
                  ) : (
                    <div className="active-operation-list">
                      {activeTrips.slice(0, 5).map((trip) => (
                        <article key={trip.id}>
                          <time>
                            {new Date(trip.departureTime).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </time>
                          <div>
                            <strong>{trip.routeName}</strong>
                            <p>{trip.busPlateNumber}</p>
                          </div>
                          <span className="badge badge-blue">
                            {trip.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTripId(trip.id);
                              setActiveTab("live");
                            }}
                          >
                            Monitor
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <aside className="attention-queue">
                  <p>Attention queue</p>
                  <button type="button" onClick={() => setActiveTab("appeals")}>
                    <span>Pending appeals</span>
                    <strong className="tabular-nums">{pendingAppeals}</strong>
                  </button>
                  <button type="button" onClick={() => setActiveTab("buses")}>
                    <span>Buses requiring attention</span>
                    <strong className="tabular-nums">
                      {attentionBuses.length}
                    </strong>
                  </button>
                  <button type="button" onClick={() => setActiveTab("trips")}>
                    <span>Upcoming Trips</span>
                    <strong className="tabular-nums">
                      {upcomingTrips.length}
                    </strong>
                  </button>
                </aside>
              </section>
              <section className="upcoming-strip">
                <div>
                  <h2>Upcoming Trips</h2>
                  <p>Next scheduled departures</p>
                </div>
                <div>
                  {upcomingTrips.length === 0 ? (
                    <p className="upcoming-empty">
                      No upcoming Trips are scheduled.
                    </p>
                  ) : (
                    upcomingTrips.slice(0, 4).map((trip) => (
                      <article key={trip.id}>
                        <time>
                          {new Date(trip.departureTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        <strong>{trip.routeName}</strong>
                        <span>{trip.busPlateNumber}</span>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "live" && (
            <LiveMonitoringTab
              trips={trips}
              selectedTripId={activeTripId}
              setSelectedTripId={setSelectedTripId}
              liveTripDetails={liveTripDetails}
              onRefresh={() => activeTripId && fetchTripDetails(activeTripId)}
            />
          )}

          {activeTab === "buses" && (
            <BusesTab
              buses={buses}
              onOpenModal={() => {
                setEditingBusId(null);
                setNewBus({
                  plateNumber: "",
                  seatedCapacity: 20,
                  standingCapacity: 8,
                  status: "ACTIVE",
                });
                setShowBusModal(true);
              }}
              onEditBus={(bus) => {
                setEditingBusId(bus.id);
                setNewBus({
                  plateNumber: bus.plateNumber,
                  seatedCapacity: bus.seatedCapacity,
                  standingCapacity: bus.standingCapacity,
                  status: bus.status,
                });
                setShowBusModal(true);
              }}
              onRetireBus={handleRetireBus}
            />
          )}

          {activeTab === "stops" && (
            <StopsTab
              stops={stops}
              onCreate={() => handleCreateStop()}
              onEdit={handleCreateStop}
              onDeactivate={handleDeactivateStop}
            />
          )}

          {activeTab === "routes" && (
            <RoutesTab
              routes={routes}
              lines={lines}
              onOpenModal={() => {
                setEditingRouteId(null);
                setNewRoute({
                  lineId: lines[0]?.id ?? "",
                  direction: "OUTBOUND",
                  name: "",
                  routeStops: [
                    { stopId: "", travelDurationToNextMinutes: 10 },
                    { stopId: "", travelDurationToNextMinutes: null },
                  ],
                });
                setShowRouteModal(true);
              }}
              onEditRoute={(route) => {
                setEditingRouteId(route.id);
                setNewRoute({
                  lineId: route.lineId,
                  direction: route.direction,
                  name: route.name,
                  routeStops: route.routeStops.map((item: any) => ({
                    stopId: item.stop.id,
                    travelDurationToNextMinutes:
                      item.travelDurationToNextMinutes,
                  })),
                });
                setShowRouteModal(true);
              }}
              onDeactivateRoute={handleDeactivateRoute}
            />
          )}

          {activeTab === "trips" && (
            <TripsTab
              isDriverPortal={false}
              trips={trips}
              onOpenModal={() => {
                setEditingTripId(null);
                setNewTrip({
                  lineId: lines[0]?.id ?? "",
                  routeId: "",
                  busId: "",
                  driverId: "",
                  blockId: "",
                  departureTime: "",
                });
                setShowTripModal(true);
              }}
              onCreateBlock={() => {
                setNewBlock({ code: "", serviceDate: "", busId: "" });
                setShowBlockModal(true);
              }}
              onEditTrip={(trip) => {
                setEditingTripId(trip.id);
                setNewTrip({
                  lineId: trip.lineId,
                  routeId: trip.routeId,
                  busId: trip.busId,
                  driverId: trip.driverId || "",
                  blockId: trip.blockId || "",
                  departureTime: new Date(trip.departureTime)
                    .toISOString()
                    .slice(0, 16),
                });
                setShowTripModal(true);
              }}
              onCancelTrip={handleCancelTrip}
            />
          )}

          {activeTab === "drivers" && (
            <DriversTab
              drivers={drivers}
              onCreate={() => handleDriver()}
              onEdit={handleDriver}
            />
          )}

          {activeTab === "appeals" && (
            <AppealsTab
              appeals={appeals}
              selectedAppeal={selectedAppeal}
              setSelectedAppeal={setSelectedAppeal}
              adminComment={adminComment}
              setAdminComment={setAdminComment}
              onReviewAppeal={handleReviewAppeal}
              isReviewing={isSubmitting}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsTab
              recommendation={recommendation}
              utilizationData={utilizationData}
              noShowData={noShowData}
            />
          )}
        </main>
      </div>

      {/* CREATE BUS MODAL */}
      {showBusModal && (
        <Modal
          isOpen
          onClose={() => setShowBusModal(false)}
          title={editingBusId ? "Edit Bus" : "Add bus to fleet"}
          maxWidth="md"
        >
          <form onSubmit={handleCreateBus} className="admin-form">
            <div>
              <label
                htmlFor="bus-plate-number"
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Plate Number
              </label>
              <input
                id="bus-plate-number"
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
                <label
                  htmlFor="bus-fleet-status"
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Fleet Status
                </label>
                <select
                  id="bus-fleet-status"
                  value={newBus.status}
                  onChange={(e) =>
                    setNewBus({ ...newBus, status: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Maintenance or retirement cancels future NOT_STARTED Trips
                  through the central cancellation workflow.
                </p>
              </div>
            )}
            <div>
              <label
                htmlFor="bus-seated-capacity"
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Seated Capacity
              </label>
              <input
                id="bus-seated-capacity"
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
                htmlFor="bus-standing-capacity"
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Standing Capacity
              </label>
              <input
                id="bus-standing-capacity"
                type="number"
                required
                min={0}
                value={newBus.standingCapacity}
                onChange={(e) =>
                  setNewBus({
                    ...newBus,
                    standingCapacity: Math.max(
                      0,
                      parseInt(e.target.value) || 0,
                    ),
                  })
                }
                className="input-field"
              />
            </div>
            <div className="admin-form-actions">
              <button
                type="button"
                onClick={() => setShowBusModal(false)}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary text-xs"
              >
                {isSubmitting
                  ? "Saving…"
                  : editingBusId
                    ? "Save Bus"
                    : "Create Bus"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE ROUTE MODAL */}
      {showRouteModal && (
        <Modal
          isOpen
          onClose={() => setShowRouteModal(false)}
          title={editingRouteId ? "Edit Route" : "Add route"}
          description="Ordered stops and travel durations define the route topology."
          maxWidth="md"
        >
          <form onSubmit={handleCreateRoute} className="admin-form">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="block text-xs font-bold mb-1.5">Service Line</span>
                <select
                  required
                  value={newRoute.lineId}
                  onChange={(event) =>
                    setNewRoute({ ...newRoute, lineId: event.target.value })
                  }
                  className="input-field"
                >
                  <option value="">Select Service Line</option>
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.code} · {line.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="block text-xs font-bold mb-1.5">Direction</span>
                <select
                  required
                  value={newRoute.direction}
                  onChange={(event) =>
                    setNewRoute({
                      ...newRoute,
                      direction: event.target.value as "OUTBOUND" | "INBOUND",
                    })
                  }
                  className="input-field"
                >
                  <option value="OUTBOUND">OUTBOUND</option>
                  <option value="INBOUND">INBOUND</option>
                </select>
              </label>
            </div>
            <div>
              <label
                htmlFor="route-name"
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Route Name
              </label>
              <input
                id="route-name"
                type="text"
                required
                placeholder="Example: TAR UMT → Melati Utama"
                value={newRoute.name}
                onChange={(e) =>
                  setNewRoute({ ...newRoute, name: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <p
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Ordered Stops and Travel Time to Next Stop
              </p>
              <div className="space-y-2">
                {newRoute.routeStops.map((routeStop, index) => (
                  <div key={index} className="grid grid-cols-[1fr_8rem] gap-2">
                    <select
                      aria-label={`Stop ${index + 1}`}
                      required
                      value={routeStop.stopId}
                      onChange={(e) =>
                        setNewRoute({
                          ...newRoute,
                          routeStops: newRoute.routeStops.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, stopId: e.target.value }
                                : item,
                          ),
                        })
                      }
                      className="input-field"
                    >
                      <option value="">Select stop</option>
                      {stops.map((stop) => (
                        <option key={stop.id} value={stop.id}>
                          {stop.code} · {stop.name}
                        </option>
                      ))}
                    </select>
                    {index < newRoute.routeStops.length - 1 ? (
                      <input
                        type="number"
                        min={1}
                        required
                        aria-label={`Travel minutes from stop ${index + 1}`}
                        value={routeStop.travelDurationToNextMinutes ?? 1}
                        onChange={(e) =>
                          setNewRoute({
                            ...newRoute,
                            routeStops: newRoute.routeStops.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      travelDurationToNextMinutes: Math.max(
                                        1,
                                        parseInt(e.target.value) || 1,
                                      ),
                                    }
                                  : item,
                            ),
                          })
                        }
                        className="input-field"
                        title="Minutes to next stop"
                      />
                    ) : (
                      <div className="input-field text-xs flex items-center">
                        Final stop
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={newRoute.routeStops.length >= 5}
                    onClick={() =>
                      setNewRoute({
                        ...newRoute,
                        routeStops: [
                          ...newRoute.routeStops.slice(0, -1).map((item) => ({
                            ...item,
                            travelDurationToNextMinutes:
                              item.travelDurationToNextMinutes ?? 10,
                          })),
                          {
                            ...newRoute.routeStops[
                              newRoute.routeStops.length - 1
                            ],
                            travelDurationToNextMinutes: 10,
                          },
                          { stopId: "", travelDurationToNextMinutes: null },
                        ],
                      })
                    }
                    className="btn-ghost text-xs"
                  >
                    Add Stop
                  </button>
                  <button
                    type="button"
                    disabled={newRoute.routeStops.length <= 2}
                    onClick={() =>
                      setNewRoute({
                        ...newRoute,
                        routeStops: newRoute.routeStops
                          .slice(0, -1)
                          .map((item, itemIndex, items) => ({
                            ...item,
                            travelDurationToNextMinutes:
                              itemIndex === items.length - 1
                                ? null
                                : item.travelDurationToNextMinutes,
                          })),
                      })
                    }
                    className="btn-ghost text-xs"
                  >
                    Remove Last
                  </button>
                </div>
              </div>
            </div>
            <div className="admin-form-actions">
              <button
                type="button"
                onClick={() => setShowRouteModal(false)}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary text-xs"
              >
                {isSubmitting
                  ? "Saving…"
                  : editingRouteId
                    ? "Save Route"
                    : "Create Route"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* SCHEDULE TRIP MODAL */}
      {showTripModal && (
        <Modal
          isOpen
          onClose={() => setShowTripModal(false)}
          title={
            editingTripId ? "Reschedule / reassign Trip" : "Schedule new Trip"
          }
          maxWidth="md"
        >
          <form onSubmit={handleCreateTrip} className="admin-form">
            {[
              {
                label: "Service Line",
                key: "lineId",
                opts: lines.map((line: any) => ({
                  v: line.id,
                  l: `${line.code} · ${line.name}`,
                })),
                ph: "Select Service Line",
                req: true,
              },
              {
                label: "Direction / Route",
                key: "routeId",
                opts: routes
                  .filter((route: any) => route.lineId === newTrip.lineId)
                  .map((route: any) => ({
                    v: route.id,
                    l: `${route.direction} · ${route.name}`,
                  })),
                ph: "Select Directional Route",
                req: true,
              },
              {
                label: "Bus",
                key: "busId",
                opts: buses
                  .filter((b: any) => b.status === "ACTIVE")
                  .map((b: any) => ({
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
              {
                label: "ServiceBlock",
                key: "blockId",
                opts: serviceBlocks.map((block: any) => ({
                  v: block.id,
                  l: `${block.code} · ${block.busPlateNumber} · ${new Date(block.serviceDate).toLocaleDateString("en-MY")}`,
                })),
                ph: "No ServiceBlock",
                req: false,
              },
            ].map(({ label, key, opts, ph, req }) => (
              <div key={key}>
                <label
                  htmlFor={`trip-${key}`}
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {label}
                </label>
                <select
                  id={`trip-${key}`}
                  required={req}
                  disabled={Boolean(
                    (editingTripId && ["lineId", "routeId", "busId", "blockId"].includes(key)) ||
                      (key === "busId" && newTrip.blockId),
                  )}
                  value={(newTrip as any)[key]}
                  onChange={(e) => {
                    if (key === "lineId") {
                      setNewTrip({ ...newTrip, lineId: e.target.value, routeId: "" });
                      return;
                    }
                    if (key === "blockId") {
                      const block = serviceBlocks.find(
                        (item: any) => item.id === e.target.value,
                      );
                      setNewTrip({
                        ...newTrip,
                        blockId: e.target.value,
                        busId: block?.busId ?? newTrip.busId,
                      });
                      return;
                    }
                    setNewTrip({ ...newTrip, [key]: e.target.value });
                  }}
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
                htmlFor="trip-departure-time"
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Departure Time
              </label>
              <input
                id="trip-departure-time"
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
              Intermediate and final times are derived from the Route
              travel-time offsets. A selected ServiceBlock locks the Trip to
              that Block&apos;s Bus and assigns the next sequence automatically.
            </p>

            <div className="admin-form-actions">
              <button
                type="button"
                onClick={() => setShowTripModal(false)}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary text-xs"
              >
                {isSubmitting
                  ? "Saving…"
                  : editingTripId
                    ? "Save Schedule"
                    : "Schedule Trip"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBlockModal && (
        <Modal
          isOpen
          onClose={() => setShowBlockModal(false)}
          title="Create ServiceBlock"
          description="Group consecutive Trips that use the same physical Bus. Drivers remain assigned per Trip."
          maxWidth="sm"
        >
          <form onSubmit={handleCreateBlock} className="admin-form">
            <label>
              <span>Block code</span>
              <input
                required
                className="input-field"
                placeholder="BLOCK-001"
                value={newBlock.code}
                onChange={(event) =>
                  setNewBlock({ ...newBlock, code: event.target.value })
                }
              />
            </label>
            <label>
              <span>Service date</span>
              <input
                required
                type="date"
                className="input-field"
                value={newBlock.serviceDate}
                onChange={(event) =>
                  setNewBlock({ ...newBlock, serviceDate: event.target.value })
                }
              />
            </label>
            <label>
              <span>Bus</span>
              <select
                required
                className="input-field"
                value={newBlock.busId}
                onChange={(event) =>
                  setNewBlock({ ...newBlock, busId: event.target.value })
                }
              >
                <option value="">Select Bus</option>
                {buses
                  .filter((bus: any) => bus.status === "ACTIVE")
                  .map((bus: any) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.plateNumber}
                    </option>
                  ))}
              </select>
            </label>
            <div className="admin-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowBlockModal(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create ServiceBlock"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Modal
        isOpen={stopForm !== null}
        onClose={() => setStopForm(null)}
        title={stopForm?.id ? "Edit stop" : "Add stop"}
        maxWidth="sm"
      >
        {stopForm && (
          <form onSubmit={submitStop} className="admin-form">
            <label>
              <span>Stable stop code</span>
              <input
                className="input-field"
                required
                value={stopForm.code}
                onChange={(event) =>
                  setStopForm({ ...stopForm, code: event.target.value })
                }
              />
            </label>
            <label>
              <span>Display name</span>
              <input
                className="input-field"
                required
                value={stopForm.name}
                onChange={(event) =>
                  setStopForm({ ...stopForm, name: event.target.value })
                }
              />
            </label>
            <div className="admin-form-grid">
              <label>
                <span>Latitude</span>
                <input
                  className="input-field tabular-nums"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  required
                  value={stopForm.latitude}
                  onChange={(event) =>
                    setStopForm({ ...stopForm, latitude: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Longitude</span>
                <input
                  className="input-field tabular-nums"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  required
                  value={stopForm.longitude}
                  onChange={(event) =>
                    setStopForm({ ...stopForm, longitude: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="admin-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStopForm(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save stop"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={driverForm !== null}
        onClose={() => setDriverForm(null)}
        title={driverForm?.id ? "Edit driver" : "Add driver"}
        maxWidth="sm"
      >
        {driverForm && (
          <form onSubmit={submitDriver} className="admin-form">
            <label>
              <span>Driver name</span>
              <input
                className="input-field"
                required
                value={driverForm.name}
                onChange={(event) =>
                  setDriverForm({ ...driverForm, name: event.target.value })
                }
              />
            </label>
            <label>
              <span>Email</span>
              <input
                className="input-field"
                type="email"
                required
                value={driverForm.email}
                onChange={(event) =>
                  setDriverForm({ ...driverForm, email: event.target.value })
                }
              />
            </label>
            {!driverForm.id && (
              <label>
                <span>Temporary password</span>
                <input
                  className="input-field"
                  type="password"
                  minLength={8}
                  required
                  value={driverForm.password}
                  onChange={(event) =>
                    setDriverForm({
                      ...driverForm,
                      password: event.target.value,
                    })
                  }
                />
                <small>
                  At least 8 characters with upper/lowercase and a number.
                </small>
              </label>
            )}
            <div className="admin-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDriverForm(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save driver"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={cancelTripTarget !== null}
        onClose={() => setCancelTripTarget(null)}
        title="Cancel Trip"
        description="This action uses the existing cancellation workflow and requires a reason."
        maxWidth="sm"
      >
        <form onSubmit={submitCancelTrip} className="admin-form">
          <label>
            <span>Cancellation reason</span>
            <textarea
              className="input-field"
              rows={4}
              required
              value={cancelTripReason}
              onChange={(event) => setCancelTripReason(event.target.value)}
            />
          </label>
          <div className="admin-form-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCancelTripTarget(null)}
            >
              Keep Trip
            </button>
            <button className="btn-danger" disabled={isSubmitting}>
              {isSubmitting ? "Cancelling…" : "Cancel Trip"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={destructiveTarget !== null}
        onClose={() => setDestructiveTarget(null)}
        onConfirm={() => void confirmDestructive()}
        title={
          destructiveTarget?.kind === "bus"
            ? "Retire bus?"
            : destructiveTarget?.kind === "route"
              ? "Deactivate route?"
              : "Deactivate stop?"
        }
        message={
          destructiveTarget?.kind === "bus"
            ? `Retire ${destructiveTarget.item.plateNumber}? Future NOT_STARTED Trips will be cancelled.`
            : destructiveTarget?.kind === "route"
              ? `Deactivate ${destructiveTarget.item.name}? Existing Trips are not rewritten.`
              : destructiveTarget
                ? `Deactivate ${destructiveTarget.item.code}? Historical Trip snapshots remain readable.`
                : ""
        }
        confirmText={
          destructiveTarget?.kind === "bus" ? "Retire bus" : "Deactivate"
        }
        cancelText="Go back"
        isDestructive
      />
    </div>
  );
}
