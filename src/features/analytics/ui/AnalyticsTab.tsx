"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BotOff,
  Bus,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Gauge,
  LocateFixed,
  MessageSquareText,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AnalyticsSignal,
  AskIntelligenceAnswer,
  OperationsIntelligenceResponse,
  OperationsInterpretationResponse,
} from "../contracts/intelligence.schemas";
import { buildExecutiveBrief } from "../domain/executive-brief";
import {
  demandHeatMaximum,
  demandHeatValue,
  formatAnalyticsDelta,
  type DemandHeatMetric,
} from "../domain/intelligence-presentation";
import {
  calculateMytPresetRange,
  parseMytDateStringToUtc,
} from "../domain/metrics";
import { formatMytDateTime } from "@/shared/time/operational-time";

type PresetRange = "7d" | "30d" | "90d" | "custom";

const severityLabel = {
  HIGH: "High",
  MEDIUM: "Medium",
  WATCH: "Watch",
  POSITIVE: "Positive",
  INFO: "Info",
} as const;

function formatRate(value: number | null) {
  return value === null ? "Insufficient data" : `${value}%`;
}

function signalClass(severity: AnalyticsSignal["severity"]) {
  return `oi-severity oi-severity-${severity.toLowerCase()}`;
}

function SignalIcon({ severity }: { severity: AnalyticsSignal["severity"] }) {
  if (severity === "POSITIVE") return <CheckCircle2 aria-hidden />;
  if (severity === "HIGH" || severity === "MEDIUM") return <AlertTriangle aria-hidden />;
  return <Activity aria-hidden />;
}

function metricDisplay(metric: { value: number | null; unit: string }) {
  if (metric.value === null) return "Insufficient data";
  if (metric.unit === "PERCENT") return `${metric.value}%`;
  if (metric.unit === "PERCENTAGE_POINTS") return `${metric.value}pp`;
  if (metric.unit === "MINUTES") return `${metric.value} min`;
  if (metric.unit === "HOURS") return `${metric.value} h`;
  return String(metric.value);
}

export default function AnalyticsTab() {
  const defaultRange = calculateMytPresetRange("30d", new Date());
  const [rangePreset, setRangePreset] = useState<PresetRange>("30d");
  const [fromDate, setFromDate] = useState(defaultRange.fromDateStr);
  const [toDate, setToDate] = useState(defaultRange.toDateStr);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedDirection, setSelectedDirection] = useState("");
  const [result, setResult] = useState<OperationsIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [heatMetric, setHeatMetric] = useState<DemandHeatMetric>("boardedPassengers");
  const [evidenceSignalId, setEvidenceSignalId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskIntelligenceAnswer | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const changePreset = (preset: PresetRange) => {
    setRangePreset(preset);
    if (preset !== "custom") {
      const range = calculateMytPresetRange(preset, new Date());
      setFromDate(range.fromDateStr);
      setToDate(range.toDateStr);
    }
  };

  const load = useCallback(async () => {
    if (fromDate > toDate) {
      setError("From date cannot be after To date.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const params = new URLSearchParams({
      from: parseMytDateStringToUtc(fromDate).toISOString(),
      to: parseMytDateStringToUtc(toDate, true).toISOString(),
    });
    if (selectedLineId) params.set("lineId", selectedLineId);
    if (selectedDirection) params.set("direction", selectedDirection);
    try {
      setError(null);
      const response = await fetch(`/api/analytics/intelligence?${params}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error?.message ?? body.error ?? "Unable to load Operations Intelligence",
        );
      }
      setResult(body.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Operations Intelligence");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, selectedDirection, selectedLineId, toDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshVersion]);

  const snapshot = result?.snapshot;
  const analytics = result?.analytics;
  const assistantStatus = result?.assistant.status;
  const snapshotFingerprint = snapshot?.fingerprint;

  useEffect(() => {
    if (
      assistantStatus !== "UPDATING" ||
      !snapshot ||
      !snapshotFingerprint
    ) return;
    const controller = new AbortController();
    const updateInterpretation = async () => {
      try {
        const response = await fetch("/api/analytics/intelligence/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            fingerprint: snapshotFingerprint,
            from: snapshot.period.from,
            to: snapshot.period.to,
            ...(snapshot.scope.lineId ? { lineId: snapshot.scope.lineId } : {}),
            ...(snapshot.scope.direction
              ? { direction: snapshot.scope.direction }
              : {}),
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(
            body.error?.message ?? body.error ?? "AI interpretation unavailable",
          );
        }
        const enrichment = body.data as OperationsInterpretationResponse;
        setResult((current) =>
          current?.snapshot.fingerprint === enrichment.fingerprint
            ? {
                ...current,
                interpretation: enrichment.interpretation,
                assistant: enrichment.assistant,
                history: enrichment.history,
              }
            : current,
        );
      } catch {
        if (controller.signal.aborted) return;
        setResult((current) =>
          current?.snapshot.fingerprint === snapshotFingerprint
            ? {
                ...current,
                assistant: {
                  ...current.assistant,
                  status: "UNAVAILABLE",
                  cached: false,
                  message:
                    "AI interpretation is temporarily unavailable. Deterministic operational signals remain current.",
                },
              }
            : current,
        );
      }
    };
    void updateInterpretation();
    return () => controller.abort();
  }, [assistantStatus, snapshot, snapshotFingerprint]);

  const focus = snapshot?.signals.find((signal) => signal.id === snapshot.focusSignalId) ?? null;
  const intelligence = result?.interpretation;
  const executive = useMemo(
    () => (snapshot ? buildExecutiveBrief(snapshot, intelligence ?? null) : []),
    [intelligence, snapshot],
  );

  const selectedEvidence = snapshot?.signals.find(
    (signal) => signal.id === evidenceSignalId,
  );
  const heatRows = snapshot?.timeBuckets ?? [];
  const maxHeatValue = demandHeatMaximum(heatRows, heatMetric);
  const heatBuckets = ["OVERNIGHT", "MORNING", "MIDDAY", "EVENING", "NIGHT"];
  const heatLines = [
    ...new Map(
      heatRows.map((row) => [`${row.lineId}:${row.direction}`, row]),
    ).values(),
  ];
  const odStops = useMemo(() => {
    if (!snapshot) return [];
    const volume = new Map<string, { code: string; name: string; total: number }>();
    for (const row of snapshot.originDestination) {
      for (const stop of [
        { code: row.boardingStopCode, name: row.boardingStopName },
        { code: row.dropOffStopCode, name: row.dropOffStopName },
      ]) {
        const current = volume.get(stop.code) ?? { ...stop, total: 0 };
        current.total += row.boardedJourneys + row.unservedDemand;
        volume.set(stop.code, current);
      }
    }
    return [...volume.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [snapshot]);

  const applySignalScope = (signal: AnalyticsSignal) => {
    setSelectedLineId(signal.scope.lineId ?? "");
    setSelectedDirection(signal.scope.direction ?? "");
    window.setTimeout(() => {
      document.getElementById(`oi-${signal.category.toLowerCase()}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const response = await fetch("/api/analytics/intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          from: parseMytDateStringToUtc(fromDate).toISOString(),
          to: parseMytDateStringToUtc(toDate, true).toISOString(),
          ...(selectedLineId ? { lineId: selectedLineId } : {}),
          ...(selectedDirection ? { direction: selectedDirection } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? body.error ?? "Assistant unavailable");
      setAnswer(body.answer);
    } catch (reason) {
      setAskError(reason instanceof Error ? reason.message : "Assistant unavailable");
    } finally {
      setAsking(false);
    }
  };

  if (loading && !result) {
    return (
      <div className="oi-loading" role="status">
        <Activity aria-hidden />
        <strong>Building the operational snapshot…</strong>
        <span>Calculating authoritative metrics and signals.</span>
      </div>
    );
  }

  return (
    <div className="analytics-view oi-view animate-fade-in">
      <header className="oi-header">
        <div>
          <p className="eyebrow">Admin decision support</p>
          <h1 className="section-title">Operations Intelligence</h1>
          <p className="section-subtitle">
            Deterministic network evidence, prioritised exceptions, and optional grounded interpretation.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            setRefreshVersion((value) => value + 1);
          }}
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden />
          {refreshing ? "Refreshing" : "Refresh evidence"}
        </button>
      </header>

      <section className="oi-filterbar" aria-label="Analytics scope">
        <CalendarRange aria-hidden />
        <div className="oi-presets">
          {(["7d", "30d", "90d", "custom"] as const).map((preset) => (
            <button
              type="button"
              key={preset}
              className={rangePreset === preset ? "is-active" : ""}
              onClick={() => changePreset(preset)}
            >
              {preset === "custom" ? "Custom" : preset.toUpperCase()}
            </button>
          ))}
        </div>
        <label>
          <span>From</span>
          <input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setRangePreset("custom"); }} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setRangePreset("custom"); }} />
        </label>
        <label>
          <span>Service Line</span>
          <select value={selectedLineId} onChange={(event) => setSelectedLineId(event.target.value)}>
            <option value="">Network</option>
            {analytics?.availableLines.map((line) => (
              <option key={line.id} value={line.id}>{line.code} · {line.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Direction</span>
          <select value={selectedDirection} onChange={(event) => setSelectedDirection(event.target.value)}>
            <option value="">Both directions</option>
            <option value="OUTBOUND">Outbound · from TAR UMT</option>
            <option value="INBOUND">Inbound · to TAR UMT</option>
          </select>
        </label>
      </section>

      {error && <div className="oi-error"><AlertTriangle aria-hidden /> {error}</div>}

      {snapshot && analytics && (
        <>
          <section className="oi-executive" aria-labelledby="executive-title">
            <div className="oi-section-heading">
              <div>
                <span className="oi-section-icon"><ShieldCheck aria-hidden /></span>
                <div>
                  <p>Prioritised brief</p>
                  <h2 id="executive-title">Executive operations intelligence</h2>
                </div>
              </div>
              <span className="oi-fingerprint" title={snapshot.fingerprint}>
                Snapshot {snapshot.fingerprint.slice(0, 10)}
              </span>
            </div>
            {executive.length === 0 ? (
              <div className="oi-no-exceptions">
                <CheckCircle2 aria-hidden />
                <div><strong>No significant operational exceptions detected.</strong><span>Continue monitoring the current evidence window.</span></div>
              </div>
            ) : (
              <div className="oi-insight-list">
                {executive.map((insight, index) => {
                  const signal = snapshot.signals.find((item) => item.id === insight.signalId);
                  if (!signal) return null;
                  return (
                    <article key={insight.signalId} className="oi-insight-row">
                      <div className={signalClass(signal.severity)}>
                        <SignalIcon severity={signal.severity} />
                        <span>{severityLabel[signal.severity]}</span>
                      </div>
                      <span className="oi-insight-rank">{String(index + 1).padStart(2, "0")}</span>
                      <div className="oi-insight-copy">
                        <h3>{insight.headline}</h3>
                        <p>{insight.observation}</p>
                        <small>{insight.interpretation}</small>
                        {insight.recommendedReview && <strong>{insight.recommendedReview}</strong>}
                      </div>
                      <div className="oi-insight-actions">
                        <span>{insight.confidence} confidence · n={signal.sampleSize}</span>
                        <button type="button" onClick={() => setEvidenceSignalId(signal.id)}>View evidence</button>
                        <button type="button" onClick={() => applySignalScope(signal)}>Open analysis <ChevronRight aria-hidden /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <div className={`oi-assistant-state is-${result.assistant.status.toLowerCase()}`}>
              {result.assistant.status === "READY" ? <Sparkles aria-hidden /> : result.assistant.status === "UPDATING" ? <RefreshCw aria-hidden /> : <BotOff aria-hidden />}
              <span>
                {result.assistant.status === "READY"
                  ? `Grounded interpretation · ${result.assistant.model}${result.assistant.cached ? " · cached" : ""}`
                  : result.assistant.message}
              </span>
            </div>
          </section>

          <section className="oi-focus" aria-labelledby="focus-title">
            <div>
              <p>Current focus</p>
              <h2 id="focus-title">{focus?.headline ?? "Network operating picture"}</h2>
              <span>
                {focus
                  ? [focus.scope.lineCode, focus.scope.direction, focus.scope.timeBucket].filter(Boolean).join(" · ") || "Network scope"
                  : "No exception currently outranks routine monitoring."}
              </span>
            </div>
            <div className="oi-focus-evidence">
              {focus?.evidenceMetricKeys.slice(0, 3).map((key) => {
                const metric = snapshot.evidence[key];
                return metric ? <div key={key}><span>{metric.label}</span><strong>{metricDisplay(metric)}</strong><small>n={metric.sampleSize}</small></div> : null;
              })}
              {!focus && <div><span>Eligible Trips</span><strong>{snapshot.eligibleTripCount}</strong><small>selected period</small></div>}
            </div>
            {focus && <button type="button" className="btn-secondary" onClick={() => setEvidenceSignalId(focus.id)}>Inspect focus evidence <ArrowRight aria-hidden /></button>}
          </section>

          <section className="oi-section" id="oi-current_operation">
            <div className="oi-section-heading">
              <div><span className="oi-section-icon"><Gauge aria-hidden /></span><div><p>Selected period vs prior comparable period</p><h2>Network Pulse</h2></div></div>
              <span>{snapshot.eligibleTripCount} eligible operated Trips</span>
            </div>
            <div className="oi-pulse-grid">
              {[
                { label: "Boarded riders", value: analytics.overview.boardedPassengers, change: snapshot.network.changes.boardedPassengers, unit: "", icon: Users },
                { label: "Reserved segment utilisation", value: analytics.overview.reservedSeatSegmentUtilization, change: snapshot.network.changes.reservedSeatSegmentUtilization, unit: "pp", icon: BarChart3, rate: true },
                { label: "On-time departure", value: analytics.overview.onTimeDepartureRate, change: snapshot.network.changes.onTimeDepartureRate, unit: "pp", icon: Clock3, rate: true },
                { label: "Average actual delay", value: analytics.overview.averageDepartureDelayMinutes, change: snapshot.network.changes.averageDepartureDelayMinutes, unit: " min", icon: Activity, minutes: true },
                { label: "Unserved demand", value: analytics.overview.unservedDemand, change: snapshot.network.changes.unservedDemand, unit: "", icon: AlertTriangle },
              ].map((metric) => (
                <article key={metric.label}>
                  <metric.icon aria-hidden />
                  <span>{metric.label}</span>
                  <strong>{metric.value === null ? "Insufficient data" : metric.rate ? `${metric.value}%` : metric.minutes ? `${metric.value} min` : metric.value}</strong>
                  <small>{formatAnalyticsDelta(metric.change, metric.unit)}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="oi-section" id="oi-demand">
            <div className="oi-section-heading">
              <div><span className="oi-section-icon"><Activity aria-hidden /></span><div><p>Service Line × MYT time window</p><h2>Demand Intelligence</h2></div></div>
              <div className="oi-metric-switch">
                <button className={heatMetric === "boardedPassengers" ? "is-active" : ""} onClick={() => setHeatMetric("boardedPassengers")}>Boarded</button>
                <button className={heatMetric === "reservedSeatSegmentUtilization" ? "is-active" : ""} onClick={() => setHeatMetric("reservedSeatSegmentUtilization")}>Reserved utilisation</button>
                <button className={heatMetric === "unservedDemand" ? "is-active" : ""} onClick={() => setHeatMetric("unservedDemand")}>Unserved</button>
              </div>
            </div>
            {heatRows.length === 0 ? <div className="oi-empty">Insufficient data for line/time demand analysis.</div> : (
              <div className="oi-heatmap" role="table" aria-label="Service Line by time-of-day heatmap">
                <div className="oi-heat-head"><span>Service</span>{heatBuckets.map((bucket) => <span key={bucket}>{bucket.toLowerCase()}</span>)}</div>
                {heatLines.map((line) => (
                  <div className="oi-heat-row" key={`${line.lineId}:${line.direction}`}>
                    <strong>{line.lineCode}<small>{line.direction}</small></strong>
                    {heatBuckets.map((bucket) => {
                      const candidates = heatRows.filter((row) => row.lineId === line.lineId && row.direction === line.direction && row.bucket === bucket);
                      const value = candidates[0]
                        ? demandHeatValue(candidates[0], heatMetric)
                        : null;
                      const intensity = value === null ? 0 : Math.max(8, Math.round((value / maxHeatValue) * 48));
                      return <div key={bucket} className="oi-heat-cell" style={{ background: `color-mix(in srgb, var(--accent) ${intensity}%, var(--surface-secondary))`, borderColor: `color-mix(in srgb, var(--accent) ${Math.round(intensity * .75)}%, var(--border-subtle))` }} title={value === null ? "Insufficient data" : `${value}${heatMetric === "reservedSeatSegmentUtilization" ? "%" : ""}`}><span>{value === null ? "—" : `${value}${heatMetric === "reservedSeatSegmentUtilization" ? "%" : ""}`}</span><small>{candidates.reduce((sum, row) => sum + row.operatedTrips, 0)} Trips</small></div>;
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="oi-two-column">
            <section className="oi-section" id="oi-reliability">
              <div className="oi-section-heading"><div><span className="oi-section-icon"><Clock3 aria-hidden /></span><div><p>Actual origin departure evidence</p><h2>Reliability Intelligence</h2></div></div></div>
              {analytics.reliability.overview.actualDepartureSamples === 0 ? <div className="oi-empty">Insufficient actual-departure data.</div> : (
                <div className="oi-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...analytics.reliability.byLine]} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <YAxis type="category" dataKey="lineCode" width={72} tick={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#111820", border: "1px solid #263241", borderRadius: 10 }} />
                      <ReferenceLine x={80} stroke="#d7a96b" strokeDasharray="4 4" label={{ value: "target", fill: "#a8b2bf", fontSize: 10 }} />
                      <Bar dataKey="onTimeDepartureRate" name="On-time departure" fill="#74A9F5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="oi-inline-facts"><span>5-minute tolerance</span><span>{analytics.reliability.overview.actualDepartureSamples} measured departures</span><span>{analytics.reliability.overview.averageDepartureDelayMinutes ?? "—"} min average actual delay</span></div>
            </section>

            <section className="oi-section" id="oi-capacity">
              <div className="oi-section-heading"><div><span className="oi-section-icon"><Users aria-hidden /></span><div><p>Usable capacity and finalized demand failure</p><h2>Capacity Intelligence</h2></div></div></div>
              <div className="oi-ranked-list">
                {[...analytics.demandPressure].sort((a, b) => b.unservedDemand - a.unservedDemand).map((line) => (
                  <article key={line.lineId}>
                    <div><strong>{line.lineCode}</strong><span>{line.lineName}</span></div>
                    <div><strong>{formatRate(line.reservedSeatSegmentUtilization)}</strong><span>reserved segment utilisation</span></div>
                    <div><strong>{line.unservedDemand}</strong><span>{line.waitlistExpired} expired wait · {line.walkInsRejectedFull} rejected full</span></div>
                  </article>
                ))}
                {analytics.demandPressure.length === 0 && <div className="oi-empty">Insufficient capacity evidence.</div>}
              </div>
            </section>
          </div>

          <div className="oi-two-column">
            <section className="oi-section" id="oi-fleet">
              <div className="oi-section-heading"><div><span className="oi-section-icon"><Bus aria-hidden /></span><div><p>Trip-derived physical Bus workload</p><h2>Fleet Intelligence</h2></div></div></div>
              <div className="oi-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...snapshot.fleet]} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="plateNumber" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#111820", border: "1px solid #263241", borderRadius: 10 }} />
                    <Bar dataKey="operatedTrips" name="Operated Trips" fill="#74A9F5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="oi-fleet-table">
                {snapshot.fleet.map((bus) => <div key={bus.busId}><strong>{bus.plateNumber}</strong><span>{bus.workloadSharePercent === null ? "Insufficient data" : `${bus.workloadSharePercent}% workload`}</span><span>{bus.actualServiceHours ?? "—"} h actual service</span><span className={bus.turnaroundAdvisories + bus.deadheadAdvisories ? "is-warning" : ""}>{bus.turnaroundAdvisories} turn · {bus.deadheadAdvisories} deadhead advisories</span></div>)}
              </div>
            </section>

            <section className="oi-section" id="oi-passenger_behaviour">
              <div className="oi-section-heading"><div><span className="oi-section-icon"><Users aria-hidden /></span><div><p>Aggregated and anonymized outcomes</p><h2>Passenger Behaviour</h2></div></div></div>
              <div className="oi-behaviour-grid">
                <div><span>Reservation → attendance outcomes</span><strong>{snapshot.passengerBehaviour.eligibleBookingOutcomes}</strong><small>finalized sample</small></div>
                <div><span>No-show rate</span><strong>{formatRate(snapshot.passengerBehaviour.noShowRate)}</strong><small>{analytics.overview.noShowCount} no-shows</small></div>
                <div><span>Waitlist promotion</span><strong>{formatRate(snapshot.passengerBehaviour.waitlistPromotionRate)}</strong><small>{snapshot.passengerBehaviour.finalizedWaitlistOutcomes} finalized outcomes</small></div>
                <div><span>Unserved demand</span><strong>{snapshot.passengerBehaviour.unservedDemand}</strong><small>expired waitlist + rejected full</small></div>
              </div>
            </section>
          </div>

          <section className="oi-section" id="oi-origin_destination">
            <div className="oi-section-heading"><div><span className="oi-section-icon"><Route aria-hidden /></span><div><p>Actual boarding → drop-off journeys</p><h2>Origin–Destination Intelligence</h2></div></div><span>External → external journeys preserved</span></div>
            {snapshot.originDestination.length === 0 ? <div className="oi-empty">Insufficient boarded or finalized-unserved OD evidence.</div> : (
              <div className="oi-od-layout">
                <div className="oi-od-matrix-wrap">
                  <table className="oi-od-matrix">
                    <caption>Boarded journey matrix · top observed stops</caption>
                    <thead><tr><th>From \ To</th>{odStops.map((stop) => <th key={stop.code} title={stop.name}>{stop.code}</th>)}</tr></thead>
                    <tbody>{odStops.map((from) => <tr key={from.code}><th title={from.name}>{from.code}</th>{odStops.map((to) => { const value = snapshot.originDestination.filter((row) => row.boardingStopCode === from.code && row.dropOffStopCode === to.code).reduce((sum, row) => sum + row.boardedJourneys, 0); return <td key={to.code} className={value ? "has-demand" : ""}>{from.code === to.code ? "—" : value || "·"}</td>; })}</tr>)}</tbody>
                  </table>
                </div>
                <div className="oi-ranked-list oi-od-ranked">
                  {snapshot.originDestination.slice(0, 8).map((row) => <article key={`${row.lineId}-${row.direction}-${row.boardingStopCode}-${row.dropOffStopCode}`}><div><strong>{row.boardingStopCode} → {row.dropOffStopCode}</strong><span>{row.lineCode} · {row.direction}</span></div><div><strong>{row.boardedJourneys}</strong><span>{row.boardedReserved} reserved · {row.boardedWalkIn} walk-in</span></div><div><strong>{row.unservedDemand}</strong><span>unserved</span></div></article>)}
                </div>
              </div>
            )}
            {snapshot.segmentLoads[0] && <div className="oi-segment-note"><LocateFixed aria-hidden /><span>Highest observed segment load</span><strong>{snapshot.segmentLoads[0].fromStopCode} → {snapshot.segmentLoads[0].toStopCode}</strong><small>{snapshot.segmentLoads[0].reservedClaims} reserved claims · {snapshot.segmentLoads[0].standingClaims} standing claims</small></div>}
          </section>

          <div className="oi-two-column">
            <section className="oi-section">
              <div className="oi-section-heading"><div><span className="oi-section-icon"><Database aria-hidden /></span><div><p>Fingerprint-backed application cache</p><h2>Intelligence History</h2></div></div></div>
              {result.history.length === 0 ? <div className="oi-empty">No cached Gemini interpretations in this server process.</div> : <div className="oi-history">{result.history.map((item) => <article key={`${item.fingerprint}-${item.generatedAt}`}><time>{formatMytDateTime(item.generatedAt)} MYT</time><div><strong>{item.headlines[0] ?? "Operational brief"}</strong><span>{item.headlines.slice(1).join(" · ") || "No additional headline"}</span></div><small>{item.model}<br />{item.fingerprint.slice(0, 10)}</small></article>)}</div>}
              <p className="oi-footnote">History is an application-level bounded cache in this implementation; deterministic records remain the source of every metric.</p>
            </section>

            <section className="oi-section oi-ask">
              <div className="oi-section-heading"><div><span className="oi-section-icon"><MessageSquareText aria-hidden /></span><div><p>Secondary read-only analysis</p><h2>Ask Operations Intelligence</h2></div></div></div>
              <form onSubmit={ask}>
                <label htmlFor="oi-question">Ask about the selected period and scope</label>
                <textarea id="oi-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Where is unserved demand concentrated?" disabled={result.assistant.status !== "READY"} />
                <button className="btn-primary" disabled={asking || result.assistant.status !== "READY"}>{asking ? "Reviewing evidence…" : "Ask with verified evidence"}<ArrowRight aria-hidden /></button>
              </form>
              {askError && <div className="oi-error"><AlertTriangle aria-hidden />{askError}</div>}
              {answer && <article className="oi-answer"><strong>Evidence-grounded answer</strong><p>{answer.answer}</p><span>{answer.evidenceMetricKeys.map((key) => snapshot.evidence[key]?.label).filter(Boolean).join(" · ")}</span>{answer.suggestedAction && answer.suggestedAction.type !== "NONE" && <button type="button" onClick={() => { if (answer.suggestedAction?.lineId) setSelectedLineId(answer.suggestedAction.lineId); if (answer.suggestedAction?.direction) setSelectedDirection(answer.suggestedAction.direction); }}>Apply suggested filter</button>}</article>}
              {result.assistant.status !== "READY" && <div className="oi-assistant-unavailable"><BotOff aria-hidden /><span>{result.assistant.message}</span></div>}
            </section>
          </div>

          <footer className="oi-quality">
            <div><Database aria-hidden /><span><strong>Data quality</strong>{snapshot.dataQuality.limitations.join(" · ")}</span></div>
            <div><ShieldCheck aria-hidden /><span><strong>Authority boundary</strong>Metrics and severity are deterministic. Gemini cannot write operations or calculate authoritative KPIs.</span></div>
          </footer>
        </>
      )}

      {selectedEvidence && snapshot && (
        <div className="oi-drawer-backdrop" role="presentation" onMouseDown={() => setEvidenceSignalId(null)}>
          <aside className="oi-evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="oi-drawer-close" onClick={() => setEvidenceSignalId(null)} aria-label="Close evidence"><X aria-hidden /></button>
            <p className="eyebrow">Traceable evidence</p>
            <h2 id="evidence-title">{selectedEvidence.headline}</h2>
            <p>{selectedEvidence.observation}</p>
            <div className="oi-evidence-metrics">{selectedEvidence.evidenceMetricKeys.map((key) => { const metric = snapshot.evidence[key]; return metric ? <article key={key}><span>{metric.label}</span><strong>{metricDisplay(metric)}</strong><small>Sample n={metric.sampleSize} · {key}</small></article> : null; })}</div>
            <dl><div><dt>Confidence</dt><dd>{selectedEvidence.evidenceStrength}</dd></div><div><dt>Recommendation level</dt><dd>{selectedEvidence.recommendationLevel.replaceAll("_", " ")}</dd></div><div><dt>Period</dt><dd>{fromDate} → {toDate} MYT</dd></div></dl>
            {selectedEvidence.scope.tripId && snapshot.tripEvidence.find((trip) => trip.tripId === selectedEvidence.scope.tripId) && <div className="oi-trip-evidence"><strong>Trip evidence</strong><span>{selectedEvidence.scope.tripId}</span><span>{snapshot.tripEvidence.find((trip) => trip.tripId === selectedEvidence.scope.tripId)?.status}</span></div>}
            <button type="button" className="btn-primary" onClick={() => { applySignalScope(selectedEvidence); setEvidenceSignalId(null); }}>Open related analysis <ChevronRight aria-hidden /></button>
          </aside>
        </div>
      )}
    </div>
  );
}
