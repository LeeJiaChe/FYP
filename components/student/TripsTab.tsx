"use client";

import { useState, useMemo } from "react";
import {
  MapPin,
  Calendar,
  Clock,
  ChevronRight,
  X,
  Ticket,
  Search,
  RefreshCw,
  Navigation,
  Filter,
  CheckCircle2,
  AlertCircle,
  Bus,
  ArrowRight,
  Check,
} from "lucide-react";
import BusLocationTracker from "@/components/BusLocationTracker";
import ConnectedRouteLine from "./ConnectedRouteLine";

interface TripsTabProps {
  routes: any[];
  trips: any[];
  loadingTrips: boolean;
  isBookingRestricted?: boolean;
  onRefresh: () => void;
  onOpenSeatModal: (tripId: string) => void;
  onTrackTrip: (trip: any) => void;
}



export default function TripsTab({
  routes,
  trips,
  loadingTrips,
  isBookingRestricted,
  onRefresh,
  onOpenSeatModal,
}: TripsTabProps) {
  // ─── Filter States ──────────────────────────────────────────
  const [routeSearchQuery, setRouteSearchQuery] = useState("");
  const [fromStopFilter, setFromStopFilter] = useState("ALL");
  const [toStopFilter, setToStopFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [timeWindowFilter, setTimeWindowFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");

  // ─── Stepper Wizard Modal State ──────────────────────────────
  const [selectedRouteForModal, setSelectedRouteForModal] = useState<any | null>(null);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1); // 1: Date -> 2: From/To -> 3: Time Slot
  const [modalSelectedDate, setModalSelectedDate] = useState<string>("");
  const [modalFromStop, setModalFromStop] = useState<string>("");
  const [modalToStop, setModalToStop] = useState<string>("");

  const [liveMapTrip, setLiveMapTrip] = useState<any | null>(null);

  // Extract all unique campus stops for top filter bar
  const { allCampusStops, availableDates } = useMemo(() => {
    const stopsSet = new Set<string>();
    const dates = new Set<string>();

    routes.forEach((r) => {
      if (Array.isArray(r.stops)) {
        r.stops.forEach((s: string) => stopsSet.add(s));
      }
    });

    trips.forEach((t) => {
      if (t.departureTime) {
        const dStr = new Date(t.departureTime).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        dates.add(dStr);
      }
    });

    return {
      allCampusStops: Array.from(stopsSet).sort(),
      availableDates: Array.from(dates).sort(),
    };
  }, [routes, trips]);

  // Ensure each unique route appears ONLY ONCE on the main grid
  const uniqueRoutesMap = new Map<string, any>();
  routes.forEach((r) => {
    if (r && r.id && !uniqueRoutesMap.has(r.id)) {
      uniqueRoutesMap.set(r.id, r);
    }
  });
  const uniqueRoutesList = Array.from(uniqueRoutesMap.values());

  // ─── Route Filtering Logic for Grid ─────────────────────────
  const filteredRoutes = uniqueRoutesList.filter((r) => {
    if (routeSearchQuery) {
      const q = routeSearchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchStops = r.stops?.some((s: string) => s.toLowerCase().includes(q));
      if (!matchName && !matchStops) return false;
    }

    if (fromStopFilter !== "ALL" && !r.stops?.includes(fromStopFilter)) return false;
    if (toStopFilter !== "ALL" && !r.stops?.includes(toStopFilter)) return false;

    if (fromStopFilter !== "ALL" && toStopFilter !== "ALL") {
      const fromIdx = r.stops?.indexOf(fromStopFilter) ?? -1;
      const toIdx = r.stops?.indexOf(toStopFilter) ?? -1;
      if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) return false;
    }

    const routeTrips = trips.filter((t) => t.routeId === r.id);

    if (dateFilter !== "ALL") {
      const hasDateMatch = routeTrips.some((t) => {
        const dStr = new Date(t.departureTime).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return dStr === dateFilter;
      });
      if (!hasDateMatch) return false;
    }

    if (timeWindowFilter !== "ALL") {
      const hasTimeMatch = routeTrips.some((t) => {
        const hour = new Date(t.departureTime).getHours();
        if (timeWindowFilter === "MORNING") return hour >= 6 && hour < 12;
        if (timeWindowFilter === "AFTERNOON") return hour >= 12 && hour < 18;
        if (timeWindowFilter === "EVENING") return hour >= 18 || hour < 6;
        return true;
      });
      if (!hasTimeMatch) return false;
    }

    if (availabilityFilter !== "ALL") {
      if (availabilityFilter === "AVAILABLE") {
        const hasAvailable = routeTrips.some((t) => (t.stats?.availableSeats ?? 0) > 0);
        if (!hasAvailable) return false;
      } else if (availabilityFilter === "WAITLIST") {
        const hasWaitlist = routeTrips.some((t) => (t.stats?.availableSeats ?? 0) === 0);
        if (!hasWaitlist) return false;
      }
    }

    return true;
  });

  // Open modal wizard for route
  function handleOpenModalForRoute(route: any) {
    setSelectedRouteForModal(route);
    setModalStep(1);

    const routeTrips = trips.filter((t) => t.routeId === route.id);
    const firstDate = routeTrips[0]
      ? new Date(routeTrips[0].departureTime).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : availableDates[0] || "ALL";

    setModalSelectedDate(firstDate);
    setModalFromStop(route.stops?.[0] || "");
    setModalToStop(route.stops?.[route.stops.length - 1] || "");
  }

  // Filter modal trips based on selected date & stop range
  const modalRouteTrips = trips.filter(
    (t) => t.routeId === selectedRouteForModal?.id
  );

  const modalAvailableDates = Array.from(
    new Set(
      modalRouteTrips.map((t) =>
        new Date(t.departureTime).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      )
    )
  );

  const filteredModalTrips = modalRouteTrips.filter((t) => {
    if (!modalSelectedDate || modalSelectedDate === "ALL") return true;
    const dateStr = new Date(t.departureTime).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return dateStr === modalSelectedDate;
  });

  function handleSelectDepartureSlot(tripId: string) {
    setSelectedRouteForModal(null);
    onOpenSeatModal(tripId);
  }

  function resetFilters() {
    setRouteSearchQuery("");
    setFromStopFilter("ALL");
    setToStopFilter("ALL");
    setDateFilter("ALL");
    setTimeWindowFilter("ALL");
    setAvailabilityFilter("ALL");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ══ ADVANCED FILTERS PANEL ══ */}
      <div
        className="glass-card p-5 rounded-2xl space-y-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Route & Schedule Filters</h3>
          </div>

          <div className="flex items-center gap-2">
            {(fromStopFilter !== "ALL" ||
              toStopFilter !== "ALL" ||
              dateFilter !== "ALL" ||
              timeWindowFilter !== "ALL" ||
              availabilityFilter !== "ALL" ||
              routeSearchQuery !== "") && (
              <button
                onClick={resetFilters}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={onRefresh}
              className="btn-ghost text-xs flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Filter Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Search Route
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={routeSearchQuery}
                onChange={(e) => setRouteSearchQuery(e.target.value)}
                placeholder="Name or stop..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              From (Boarding Stop)
            </label>
            <select
              value={fromStopFilter}
              onChange={(e) => setFromStopFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Any Boarding Stop</option>
              {allCampusStops.map((stop) => (
                <option key={stop} value={stop}>
                  {stop}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              To (Dropoff Stop)
            </label>
            <select
              value={toStopFilter}
              onChange={(e) => setToStopFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Any Dropoff Stop</option>
              {allCampusStops.map((stop) => (
                <option key={stop} value={stop}>
                  {stop}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Departure Date
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Dates</option>
              {availableDates.map((dStr) => (
                <option key={dStr} value={dStr}>
                  {dStr}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Time Slot
            </label>
            <select
              value={timeWindowFilter}
              onChange={(e) => setTimeWindowFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Times</option>
              <option value="MORNING">Morning (6 AM - 12 PM)</option>
              <option value="AFTERNOON">Afternoon (12 PM - 6 PM)</option>
              <option value="EVENING">Evening (6 PM - 12 AM)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Seat Availability
            </label>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Routes</option>
              <option value="AVAILABLE">Seats Available Only</option>
              <option value="WAITLIST">Waitlist Open</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            Campus Routes ({filteredRoutes.length} Directional Lines)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click on any route to select date, boarding & dropoff stops, and seat.
          </p>
        </div>
      </div>

      {/* ══ DISPLAY EACH DIRECTIONAL ROUTE LINE ══ */}
      {filteredRoutes.length === 0 ? (
        <div className="py-12 text-center rounded-2xl glass-card border border-slate-800 space-y-3">
          <Bus className="w-10 h-10 mx-auto text-slate-500" />
          <p className="text-sm font-bold text-slate-300">No routes match your current filter selection.</p>
          <button onClick={resetFilters} className="btn-ghost text-xs">
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRoutes.map((r, idx) => {
            const routeTrips = trips.filter((t) => t.routeId === r.id);
            const routeTripsCount = routeTrips.length;

            const liveTrip = routeTrips.find(
              (t) =>
                t.status === "BOARDING" ||
                t.status === "DEPARTED" ||
                (new Date(t.departureTime).getTime() - Date.now() > 0 &&
                  new Date(t.departureTime).getTime() - Date.now() < 45 * 60 * 1000)
            );

            return (
              <div
                key={r.id}
                className="glass-card p-5 rounded-2xl space-y-4 flex flex-col justify-between border border-slate-800 hover:border-indigo-500/40 transition-all duration-200 animate-slide-up group relative overflow-hidden"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Directional Route
                    </span>

                    {liveTrip ? (
                      <button
                        onClick={() => setLiveMapTrip(liveTrip)}
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm shadow-emerald-500/20"
                        title="Click to view real-time bus map location"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot shrink-0" />
                        <span>LIVE ROUTE MAP</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                        {routeTripsCount} Departure Slots
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                    {r.name}
                  </h3>

                  {/* CONNECTED ROUTE LINE VISUAL DISPLAY */}
                  <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider px-1">
                      Route Stops Sequence:
                    </span>
                    <ConnectedRouteLine stops={r.stops || []} />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {liveTrip && (
                    <button
                      onClick={() => setLiveMapTrip(liveTrip)}
                      className="w-full text-[11px] py-1.5 rounded-xl font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                      Track Live Bus Location
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenModalForRoute(r)}
                    disabled={!!isBookingRestricted}
                    className="btn-primary w-full text-xs flex items-center justify-center gap-2"
                  >
                    <span>Select Date & Destination</span>
                    <ArrowRight className="w-4 h-4 text-indigo-200" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ STEPPER WIZARD MODAL: ROUTE -> DATE -> FROM/TO DESTINATION -> TIME ══ */}
      {selectedRouteForModal && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-2xl p-6 relative animate-scale-up space-y-5">
            <button
              onClick={() => setSelectedRouteForModal(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Title */}
            <div>
              <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
                4-Step Booking Process
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                {selectedRouteForModal.name}
              </h2>
            </div>

            {/* Stepper Bar Header */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setModalStep(1)}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  modalStep === 1
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <span className="text-[10px] block font-extrabold uppercase">Step 1</span>
                <span className="text-xs font-bold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Pick Date
                </span>
              </button>

              <button
                onClick={() => setModalStep(2)}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  modalStep === 2
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <span className="text-[10px] block font-extrabold uppercase">Step 2</span>
                <span className="text-xs font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> From / To Stops
                </span>
              </button>

              <button
                onClick={() => setModalStep(3)}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  modalStep === 3
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <span className="text-[10px] block font-extrabold uppercase">Step 3</span>
                <span className="text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Time & Seat
                </span>
              </button>
            </div>

            {/* STEP 1: SELECT DATE */}
            {modalStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>Choose Departure Date:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modalAvailableDates.map((dateStr) => (
                      <button
                        key={dateStr}
                        onClick={() => {
                          setModalSelectedDate(dateStr);
                          setModalStep(2);
                        }}
                        className={`p-3 rounded-xl text-left font-bold text-xs transition-all flex items-center justify-between border ${
                          modalSelectedDate === dateStr
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25"
                            : "bg-slate-800/80 text-slate-300 border-slate-700/60 hover:border-indigo-500/50"
                        }`}
                      >
                        <span>{dateStr}</span>
                        {modalSelectedDate === dateStr && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setModalStep(2)}
                    className="btn-primary text-xs flex items-center gap-1.5"
                  >
                    Next: From & To Stops <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SELECT FROM & TO DESTINATION STOPS */}
            {modalStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold">
                    <MapPin className="w-4 h-4 text-indigo-400" />
                    <span>Select Boarding & Dropoff Segment:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Boarding Stop (From)
                      </label>
                      <select
                        value={modalFromStop}
                        onChange={(e) => setModalFromStop(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500"
                      >
                        {selectedRouteForModal.stops?.map((stop: string, i: number) => (
                          <option key={stop} value={stop} disabled={i === selectedRouteForModal.stops.length - 1}>
                            {stop} {i === 0 ? "(Origin)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Dropoff Stop (To)
                      </label>
                      <select
                        value={modalToStop}
                        onChange={(e) => setModalToStop(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500"
                      >
                        {selectedRouteForModal.stops?.map((stop: string, i: number) => (
                          <option key={stop} value={stop} disabled={i <= selectedRouteForModal.stops.indexOf(modalFromStop)}>
                            {stop} {i === selectedRouteForModal.stops.length - 1 ? "(Destination)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* CONNECTED LINE PREVIEW OF SELECTED LEG */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      Selected Leg Preview:
                    </span>
                    <ConnectedRouteLine
                      stops={selectedRouteForModal.stops || []}
                      fromStop={modalFromStop}
                      toStop={modalToStop}
                    />
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setModalStep(1)} className="btn-ghost text-xs">
                    Back to Date
                  </button>
                  <button onClick={() => setModalStep(3)} className="btn-primary text-xs flex items-center gap-1.5">
                    Next: Pick Time Slot <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SELECT TIME SLOT & SEAT */}
            {modalStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                {/* Summary Banner */}
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between text-indigo-300 font-semibold">
                  <span>
                    📅 {modalSelectedDate} • 🚏 {modalFromStop} → {modalToStop}
                  </span>
                  <button onClick={() => setModalStep(2)} className="text-[10px] underline text-indigo-400 hover:text-white">
                    Change Leg
                  </button>
                </div>

                {filteredModalTrips.length === 0 ? (
                  <div className="py-10 text-center rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                    <Calendar className="w-8 h-8 mx-auto text-slate-500" />
                    <p className="text-xs font-bold text-slate-400">
                      No departure times scheduled for this date.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {filteredModalTrips.map((t) => {
                      const isFull = t.stats?.availableSeats === 0;
                      const departureTimeStr = new Date(t.departureTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={t.id}
                          className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-3 hover:border-indigo-500/50 transition-all"
                        >
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 text-sm font-extrabold text-indigo-300">
                                <Clock className="w-4 h-4 text-indigo-400" />
                                <span>{departureTimeStr}</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {t.busPlateNumber}
                              </span>
                            </div>

                            <div className="flex justify-between text-xs text-slate-400 pt-1">
                              <span>Leg Seat Status</span>
                              <span
                                className="font-bold"
                                style={{ color: isFull ? "#ef4444" : "#4ade80" }}
                              >
                                {t.stats?.availableSeats ?? "—"} / {t.stats?.totalSeats ?? "—"} available
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSelectDepartureSlot(t.id)}
                            disabled={!!isBookingRestricted}
                            className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                            style={
                              isFull
                                ? { background: "linear-gradient(135deg, #d97706, #f59e0b)" }
                                : {}
                            }
                          >
                            <Ticket className="w-3.5 h-3.5" />
                            {isFull ? "Join Waitlist" : "Select Seat Matrix"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 flex justify-between">
                  <button onClick={() => setModalStep(2)} className="btn-ghost text-xs">
                    Back to Segment
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRouteForModal(null)}
                    className="btn-ghost text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ LIVE BUS MAP LOCATION MODAL ══ */}
      {liveMapTrip && (
        <div className="modal-overlay">
          <div className="modal-content w-full max-w-xl p-6 relative animate-scale-up space-y-4">
            <button
              onClick={() => setLiveMapTrip(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 transition-colors z-20"
            >
              <X className="w-4 h-4" />
            </button>

            <BusLocationTracker
              tripId={liveMapTrip.id}
              routeName={liveMapTrip.routeName}
              stops={liveMapTrip.routeStops || []}
              departureTime={liveMapTrip.departureTime}
              estimatedArrivalTime={liveMapTrip.estimatedArrivalTime}
              busPlateNumber={liveMapTrip.busPlateNumber}
              status={liveMapTrip.status || "BOARDING"}
            />

            <div className="flex justify-end">
              <button onClick={() => setLiveMapTrip(null)} className="btn-ghost text-xs">
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
