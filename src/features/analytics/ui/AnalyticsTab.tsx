"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Clock,
  Info,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  OperationsAnalyticsResponse,
} from "../contracts/analytics.schemas";
import type { OperationalInsight } from "../domain/metrics";

type PresetRange = "7d" | "30d" | "90d" | "custom";
type SortField =
  | "lineName"
  | "boardedPassengers"
  | "reservedSeatSegmentUtilization"
  | "onTimeDepartureRate"
  | "averageDepartureDelayMinutes"
  | "noShowRate"
  | "unservedDemand"
  | "operationalCancellationCount";

export default function AnalyticsTab() {
  const [rangePreset, setRangePreset] = useState<PresetRange>("30d");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0]!;
  });
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0]!;
  });
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [selectedDirection, setSelectedDirection] = useState<string>("");

  const [data, setData] = useState<OperationsAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const [sortField, setSortField] = useState<SortField>("boardedPassengers");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [showDirectionBreakdown, setShowDirectionBreakdown] = useState<boolean>(false);

  const handlePresetChange = (preset: PresetRange) => {
    setRangePreset(preset);
    const now = new Date();
    const to = now.toISOString().split("T")[0]!;
    let days = 30;
    if (preset === "7d") days = 7;
    if (preset === "90d") days = 90;

    if (preset !== "custom") {
      const fromD = new Date();
      fromD.setDate(now.getDate() - days);
      const from = fromD.toISOString().split("T")[0]!;
      setFromDate(from);
      setToDate(to);
    }
  };

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("from", new Date(fromDate).toISOString());
        if (toDate) {
          const toD = new Date(toDate);
          toD.setHours(23, 59, 59, 999);
          params.set("to", toD.toISOString());
        }
        if (selectedLineId) params.set("lineId", selectedLineId);
        if (selectedDirection) params.set("direction", selectedDirection);

        const res = await fetch(`/api/analytics/operations?${params.toString()}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || `Failed to fetch analytics (Status ${res.status})`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json.data);
          setLastRefreshed(new Date());
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, selectedLineId, selectedDirection, refreshTrigger]);


  const sortedLinePerformance = useMemo(() => {
    if (!data) return [];
    return [...data.linePerformance].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case "lineName":
          valA = a.lineName;
          valB = b.lineName;
          break;
        case "boardedPassengers":
          valA = a.boardedPassengers;
          valB = b.boardedPassengers;
          break;
        case "reservedSeatSegmentUtilization":
          valA = a.reservedSeatSegmentUtilization ?? -1;
          valB = b.reservedSeatSegmentUtilization ?? -1;
          break;
        case "onTimeDepartureRate":
          valA = a.onTimeDepartureRate ?? -1;
          valB = b.onTimeDepartureRate ?? -1;
          break;
        case "averageDepartureDelayMinutes":
          valA = a.averageDepartureDelayMinutes ?? -1;
          valB = b.averageDepartureDelayMinutes ?? -1;
          break;
        case "noShowRate":
          valA = a.noShowRate ?? -1;
          valB = b.noShowRate ?? -1;
          break;
        case "unservedDemand":
          valA = a.unservedDemand;
          valB = b.unservedDemand;
          break;
        case "operationalCancellationCount":
          valA = a.operationalCancellationCount;
          valB = b.operationalCancellationCount;
          break;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [data, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const formatRate = (rate: number | null | undefined, suffix = "%"): string => {
    if (rate === null || rate === undefined) return "—";
    return `${rate}${suffix}`;
  };

  const getSeverityBadge = (severity: OperationalInsight["severity"]) => {
    switch (severity) {
      case "danger":
        return <span className="badge badge-danger">High Concern</span>;
      case "warning":
        return <span className="badge badge-warning">Attention</span>;
      case "success":
        return <span className="badge badge-success">Target Met</span>;
      default:
        return <span className="badge badge-info">Information</span>;
    }
  };

  return (
    <div className="analytics-view animate-fade-in pb-12">
      {/* HEADER */}
      <header className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="eyebrow">Operational Intelligence & Decision Support</p>
            <h1 className="section-title text-2xl font-bold">Operations Analytics</h1>
            <p className="section-subtitle text-sm text-[var(--text-muted)] mt-1">
              Ridership patterns, capacity pressure, corridor reliability, and fleet utilization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                Refreshed {lastRefreshed.toLocaleTimeString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })} MYT
              </span>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isLoading || isRefreshing}
              className="btn btn-secondary flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Prototype disclosure banner */}
        <div className="mt-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-muted)] text-[var(--text-muted)] text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <span>
            Analytics reflect records generated within this shuttle system prototype (Asia/Kuala_Lumpur, MYT UTC+8) and are not official TAR UMT operational reporting.
          </span>
        </div>
      </header>

      {/* FILTER BAR */}
      <section className="analytics-filters mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Preset Buttons */}
          <div className="flex items-center p-1 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border)] text-xs">
            <button
              type="button"
              onClick={() => handlePresetChange("7d")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                rangePreset === "7d"
                  ? "bg-[var(--accent-primary)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Last 7d
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("30d")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                rangePreset === "30d"
                  ? "bg-[var(--accent-primary)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Last 30d
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("90d")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                rangePreset === "90d"
                  ? "bg-[var(--accent-primary)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Last 90d
            </button>
          </div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="filter-from-date" className="text-[var(--text-muted)] font-medium">From:</label>
            <input
              id="filter-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setRangePreset("custom");
              }}
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            <label htmlFor="filter-to-date" className="text-[var(--text-muted)] font-medium">To:</label>
            <input
              id="filter-to-date"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setRangePreset("custom");
              }}
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          {/* Service Line Filter */}
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="filter-service-line" className="text-[var(--text-muted)] font-medium">Line:</label>
            <select
              id="filter-service-line"
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
              <option value="">All Service Lines</option>
              {data?.linePerformance.map((l) => (
                <option key={l.lineId} value={l.lineId}>
                  {l.lineName} ({l.lineCode})
                </option>
              ))}
            </select>
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="filter-direction" className="text-[var(--text-muted)] font-medium">Direction:</label>
            <select
              id="filter-direction"
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
              <option value="">All Directions</option>
              <option value="OUTBOUND">OUTBOUND (To Campus)</option>
              <option value="INBOUND">INBOUND (From Campus)</option>
            </select>
          </div>
        </div>
      </section>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 rounded-xl border border-[var(--danger)] bg-[var(--danger-subtle)] text-[var(--danger)] mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold">Error Loading Analytics</h2>
            <p className="text-xs mt-1">{error}</p>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="mt-2 text-xs underline font-semibold cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* LOADING SKELETON */}
      {isLoading && (
        <div className="p-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
          <p className="text-sm font-medium">Aggregating operations intelligence...</p>
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* TOP KPI CARDS ROW */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {/* 1. Boarded Passengers */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Boarded Riders</span>
                <span title="Total passenger journeys checked in (reserved) plus boarded walk-ins.">
                  <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {data.overview.boardedPassengers}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {data.overview.completedTrips} completed / {data.overview.operatedTrips} operated
              </div>
            </div>

            {/* 2. Reserved Seat-Segment Utilization */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Reserved Util.</span>
                <span title="Reserved seat-segments divided by available seated capacity segments on operated trips.">
                  <BarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {formatRate(data.overview.reservedSeatSegmentUtilization)}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                Across {data.overview.operatedTrips} operated Trips
              </div>
            </div>

            {/* 3. On-Time Departure Rate */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">On-Time Dep.</span>
                <span title="Departed origin stop within 5 minutes of planned departure.">
                  <Clock className="w-4 h-4 text-[var(--success)]" />
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {formatRate(data.overview.onTimeDepartureRate)}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {data.overview.actualDepartureSamples} measured departures
              </div>
            </div>

            {/* 4. Average Departure Delay */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Dep. Delay</span>
                <span title="Average delay past planned origin departure. Early departure = 0 min.">
                  <Clock className="w-4 h-4 text-[var(--warning)]" />
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {data.overview.averageDepartureDelayMinutes !== null
                  ? `${data.overview.averageDepartureDelayMinutes}m`
                  : "—"}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                Max: {data.reliability.overview.maxDepartureDelayMinutes !== null
                  ? `${data.reliability.overview.maxDepartureDelayMinutes}m`
                  : "—"}
              </div>
            </div>

            {/* 5. Reservation No-Show Rate */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">No-Show Rate</span>
                <span title="No-shows divided by completed, checked-in, or no-show bookings.">
                  <XCircle className="w-4 h-4 text-[var(--danger)]" />
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {formatRate(data.overview.noShowRate)}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {data.overview.noShowCount} no-shows / {data.overview.eligibleBookingOutcomes} outcomes
              </div>
            </div>

            {/* 6. Unserved Demand */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Unserved Demand</span>
                <span title="Expired waitlists plus rejected full walk-in intents.">
                  <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {data.overview.unservedDemand}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {data.overview.waitlistExpired} expired wait, {data.overview.walkInsRejectedFull} rejected walk-in
              </div>
            </div>
          </section>

          {/* SECTION 1: RULE-BASED OPERATIONAL INSIGHTS */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Rule-Based Operational Insights</span>
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                Deterministic threshold analysis
              </span>
            </div>

            {data.insights.length === 0 ? (
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-xs text-[var(--text-muted)]">
                No active operational anomalies or warnings detected for this period.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.insights.map((insight, idx) => (
                  <div
                    key={`${insight.type}-${idx}`}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                          {insight.title}
                        </h3>
                        {getSeverityBadge(insight.severity)}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
                        {insight.message}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Evidence: {insight.evidence}</span>
                      <span className="font-mono">n={insight.sampleSize}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 2: SERVICE LINE PERFORMANCE TABLE */}
          <section className="mb-8 p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Service Line Performance Comparison
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Cross-line operational benchmark for scheduling and capacity decisions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirectionBreakdown(!showDirectionBreakdown)}
                  className="btn btn-secondary text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-surface-hover)]"
                >
                  {showDirectionBreakdown ? "Hide Directional Split" : "Show Directional Split"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-surface-muted)]">
                    <th
                      className="p-2.5 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("lineName")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Service Line</span>
                        {sortField === "lineName" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="p-2.5 font-semibold text-center">Trips (Sched/Oper/Done)</th>
                    <th
                      className="p-2.5 font-semibold text-right cursor-pointer select-none"
                      onClick={() => handleSort("boardedPassengers")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Boarded</span>
                        {sortField === "boardedPassengers" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      className="p-2.5 font-semibold text-right cursor-pointer select-none"
                      onClick={() => handleSort("reservedSeatSegmentUtilization")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Reserved Util.</span>
                        {sortField === "reservedSeatSegmentUtilization" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      className="p-2.5 font-semibold text-right cursor-pointer select-none"
                      onClick={() => handleSort("onTimeDepartureRate")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>On-Time</span>
                        {sortField === "onTimeDepartureRate" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      className="p-2.5 font-semibold text-right cursor-pointer select-none"
                      onClick={() => handleSort("averageDepartureDelayMinutes")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Avg Delay</span>
                        {sortField === "averageDepartureDelayMinutes" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      className="p-2.5 font-semibold text-right cursor-pointer select-none"
                      onClick={() => handleSort("noShowRate")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>No-Show</span>
                        {sortField === "noShowRate" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      className="p-2.5 font-semibold text-right cursor-pointer select-none"
                      onClick={() => handleSort("unservedDemand")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Unserved</span>
                        {sortField === "unservedDemand" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      className="p-2.5 font-semibold text-right cursor-pointer select-none"
                      onClick={() => handleSort("operationalCancellationCount")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Cancellations</span>
                        {sortField === "operationalCancellationCount" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedLinePerformance.map((row) => (
                    <>
                      <tr key={row.lineId} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                        <td className="p-2.5 font-medium text-[var(--text-primary)]">
                          <div className="font-semibold">{row.lineName}</div>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">{row.lineCode}</div>
                        </td>
                        <td className="p-2.5 text-center tabular-nums text-[var(--text-muted)]">
                          {row.scheduledTrips} / {row.operatedTrips} / {row.completedTrips}
                        </td>
                        <td className="p-2.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                          {row.boardedPassengers}
                        </td>
                        <td className="p-2.5 text-right tabular-nums">
                          <span
                            className={
                              row.reservedSeatSegmentUtilization !== null && row.reservedSeatSegmentUtilization >= 80
                                ? "text-[var(--warning)] font-semibold"
                                : ""
                            }
                          >
                            {formatRate(row.reservedSeatSegmentUtilization)}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums">
                          <span
                            className={
                              row.onTimeDepartureRate !== null && row.onTimeDepartureRate < 80
                                ? "text-[var(--danger)] font-semibold"
                                : ""
                            }
                          >
                            {formatRate(row.onTimeDepartureRate)}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums text-[var(--text-secondary)]">
                          {row.averageDepartureDelayMinutes !== null ? `${row.averageDepartureDelayMinutes}m` : "—"}
                        </td>
                        <td className="p-2.5 text-right tabular-nums">
                          <span
                            className={
                              row.noShowRate !== null && row.noShowRate >= 10
                                ? "text-[var(--danger)] font-semibold"
                                : ""
                            }
                          >
                            {formatRate(row.noShowRate)}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums">
                          <span className={row.unservedDemand > 0 ? "text-[var(--danger)] font-semibold" : ""}>
                            {row.unservedDemand}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums text-[var(--text-muted)]">
                          {row.operationalCancellationCount}
                        </td>
                      </tr>

                      {/* Directional Split sub-rows */}
                      {showDirectionBreakdown && (
                        <>
                          <tr className="bg-[var(--bg-surface-muted)] text-[11px] text-[var(--text-muted)]">
                            <td className="pl-6 py-1.5 font-medium">↳ Outbound (To Campus)</td>
                            <td className="text-center py-1.5 tabular-nums">
                              {row.directions.outbound.scheduledTrips} / {row.directions.outbound.operatedTrips} / {row.directions.outbound.completedTrips}
                            </td>
                            <td className="text-right py-1.5 tabular-nums">{row.directions.outbound.boardedPassengers}</td>
                            <td className="text-right py-1.5 tabular-nums">{formatRate(row.directions.outbound.reservedSeatSegmentUtilization)}</td>
                            <td className="text-right py-1.5 tabular-nums">{formatRate(row.directions.outbound.onTimeDepartureRate)}</td>
                            <td className="text-right py-1.5 tabular-nums">
                              {row.directions.outbound.averageDepartureDelayMinutes !== null ? `${row.directions.outbound.averageDepartureDelayMinutes}m` : "—"}
                            </td>
                            <td className="text-right py-1.5 tabular-nums">{formatRate(row.directions.outbound.noShowRate)}</td>
                            <td className="text-right py-1.5 tabular-nums">{row.directions.outbound.unservedDemand}</td>
                            <td className="text-right py-1.5 tabular-nums">{row.directions.outbound.operationalCancellationCount}</td>
                          </tr>
                          <tr className="bg-[var(--bg-surface-muted)] text-[11px] text-[var(--text-muted)]">
                            <td className="pl-6 py-1.5 font-medium">↳ Inbound (From Campus)</td>
                            <td className="text-center py-1.5 tabular-nums">
                              {row.directions.inbound.scheduledTrips} / {row.directions.inbound.operatedTrips} / {row.directions.inbound.completedTrips}
                            </td>
                            <td className="text-right py-1.5 tabular-nums">{row.directions.inbound.boardedPassengers}</td>
                            <td className="text-right py-1.5 tabular-nums">{formatRate(row.directions.inbound.reservedSeatSegmentUtilization)}</td>
                            <td className="text-right py-1.5 tabular-nums">{formatRate(row.directions.inbound.onTimeDepartureRate)}</td>
                            <td className="text-right py-1.5 tabular-nums">
                              {row.directions.inbound.averageDepartureDelayMinutes !== null ? `${row.directions.inbound.averageDepartureDelayMinutes}m` : "—"}
                            </td>
                            <td className="text-right py-1.5 tabular-nums">{formatRate(row.directions.inbound.noShowRate)}</td>
                            <td className="text-right py-1.5 tabular-nums">{row.directions.inbound.unservedDemand}</td>
                            <td className="text-right py-1.5 tabular-nums">{row.directions.inbound.operationalCancellationCount}</td>
                          </tr>
                        </>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 3 & 4: CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* SECTION 3: RIDERSHIP BY DEPARTURE HOUR */}
            <section className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Boarded Ridership by Departure Hour (MYT)
                  </h2>
                  <span className="text-[11px] text-[var(--text-muted)]">UTC+8</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Distribution of checked-in & walk-in riders by planned shuttle departure hour.
                </p>

                {data.overview.boardedPassengers === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
                    No boarded passenger records in this period.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...data.hourlyRidership]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} />
                        <YAxis stroke="var(--text-muted)" fontSize={10} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-surface)",
                            borderColor: "var(--border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "var(--text-primary)",
                          }}
                        />
                        <Bar dataKey="boardedRidership" name="Boarded Passengers" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 4: DEMAND PRESSURE & UNSERVED REQUESTS */}
            <section className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Corridor Capacity Pressure & Unmet Demand
                  </h2>
                  <span className="text-[11px] text-[var(--text-muted)]">Expired Waitlists & Rejections</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Lines experiencing high reserved utilization alongside unserved student demand.
                </p>

                <div className="space-y-3">
                  {data.demandPressure.map((dp) => (
                    <div
                      key={dp.lineId}
                      className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-muted)] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">{dp.lineName}</span>
                          {dp.pressureFlag && <span className="badge badge-warning text-[10px]">High Pressure</span>}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          Reserved: {formatRate(dp.reservedSeatSegmentUtilization)} across {dp.operatedTrips} operated Trips
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                          {dp.unservedDemand} unserved
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {dp.waitlistExpired} expired wait / {dp.walkInsRejectedFull} rejected full
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* SECTION 5: SERVICE RELIABILITY & FLEET PERFORMANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* RELIABILITY */}
            <section className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Departure Reliability & Delays by Line
              </h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Punctuality against 5-minute tolerance threshold from origin departure.
              </p>

              {data.reliability.overview.actualDepartureSamples === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
                  No origin departure samples recorded in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                        <th className="py-2">Line</th>
                        <th className="py-2 text-right">On-Time Rate</th>
                        <th className="py-2 text-right">Avg Delay</th>
                        <th className="py-2 text-right">Max Delay</th>
                        <th className="py-2 text-right">Samples</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.reliability.byLine.map((rel) => (
                        <tr key={rel.lineId} className="hover:bg-[var(--bg-surface-hover)]">
                          <td className="py-2 font-medium">{rel.lineName}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">
                            {formatRate(rel.onTimeDepartureRate)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">
                            {rel.averageDepartureDelayMinutes !== null ? `${rel.averageDepartureDelayMinutes}m` : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">
                            {rel.maxDepartureDelayMinutes !== null ? `${rel.maxDepartureDelayMinutes}m` : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums text-[var(--text-muted)] font-mono">
                            {rel.actualDepartureSamples}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* FLEET PERFORMANCE */}
            <section className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Fleet Asset Utilization
              </h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Operational volume and service hours recorded per shuttle bus.
              </p>

              {data.fleetPerformance.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
                  No bus records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                        <th className="py-2">Plate Number</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-right">Operated</th>
                        <th className="py-2 text-right">Boarded</th>
                        <th className="py-2 text-right">Util.</th>
                        <th className="py-2 text-right">Service Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.fleetPerformance.map((bus) => (
                        <tr key={bus.busId} className="hover:bg-[var(--bg-surface-hover)]">
                          <td className="py-2 font-mono font-semibold text-[var(--text-primary)]">
                            {bus.plateNumber}
                          </td>
                          <td className="py-2">
                            <span
                              className={`badge text-[10px] ${
                                bus.status === "ACTIVE"
                                  ? "badge-success"
                                  : bus.status === "MAINTENANCE"
                                  ? "badge-warning"
                                  : "badge-danger"
                              }`}
                            >
                              {bus.status}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">{bus.operatedTrips}</td>
                          <td className="py-2 text-right tabular-nums font-medium">{bus.boardedPassengers}</td>
                          <td className="py-2 text-right tabular-nums">{formatRate(bus.reservedSeatSegmentUtilization)}</td>
                          <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">
                            {bus.actualServiceHours !== null ? `${bus.actualServiceHours}h` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* DATA QUALITY & AUDIT DISCLOSURE */}
          <footer className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-muted)] text-xs text-[var(--text-muted)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-[var(--text-primary)]">Data Quality & Exclusions: </span>
              {data.dataQuality.excludedAdministrativeCleanupTrips > 0 ? (
                <span>
                  {data.dataQuality.excludedAdministrativeCleanupTrips} administrative prototype rollover records excluded from reliability denominators.
                </span>
              ) : (
                <span>Zero administrative cleanup exclusions in selected range.</span>
              )}
            </div>
            <div className="text-[11px] font-mono">
              Completed Samples: {data.dataQuality.completedTripSamples} | Departure Samples: {data.dataQuality.actualDepartureSamples}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

