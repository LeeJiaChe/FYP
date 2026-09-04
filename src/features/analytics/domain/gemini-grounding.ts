import type {
  AnalyticsSnapshot,
  AskIntelligenceAnswer,
  GeminiIntelligence,
} from "../contracts/intelligence.schemas";

export function buildGeminiContext(snapshot: AnalyticsSnapshot) {
  const requestedSignals = snapshot.signals.slice(0, 5);
  const requestedEvidenceKeys = new Set(
    requestedSignals.flatMap((signal) => signal.evidenceMetricKeys),
  );
  return {
    period: snapshot.period,
    comparisonPeriod: snapshot.comparisonPeriod,
    scope: snapshot.scope,
    eligibleTripCount: snapshot.eligibleTripCount,
    dataQuality: snapshot.dataQuality,
    network: snapshot.network,
    serviceLines: snapshot.serviceLines.map((line) => ({
      lineId: line.lineId,
      lineCode: line.lineCode,
      scheduledTrips: line.scheduledTrips,
      operatedTrips: line.operatedTrips,
      boardedPassengers: line.boardedPassengers,
      reservedSeatSegmentUtilization: line.reservedSeatSegmentUtilization,
      onTimeDepartureRate: line.onTimeDepartureRate,
      averageDepartureDelayMinutes: line.averageDepartureDelayMinutes,
      unservedDemand: line.unservedDemand,
      noShowRate: line.noShowRate,
      directions: line.directions,
    })),
    timeBuckets: snapshot.timeBuckets,
    originDestination: snapshot.originDestination.slice(0, 30),
    segmentLoads: snapshot.segmentLoads.slice(0, 30),
    fleet: snapshot.fleet,
    passengerBehaviour: snapshot.passengerBehaviour,
    requiredOverallState: deterministicOverallState(snapshot),
    signals: requestedSignals.map((signal) => {
      if (signal.type === "OVERDUE_UNSTARTED_TRIP") {
        return {
          ...signal,
          observation:
            "Scheduled departure has passed without operational progress.",
          observedValue: null,
        };
      }
      if (signal.type === "STALE_TELEMETRY") {
        return {
          ...signal,
          observation:
            "Telemetry is absent or beyond the configured freshness threshold.",
          observedValue: null,
        };
      }
      return signal;
    }),
    evidence: Object.fromEntries(
      Object.entries(snapshot.evidence)
        .filter(([key]) => requestedEvidenceKeys.has(key))
        .map(([key, metric]) => [
          key,
          key.endsWith(".overdueMinutes") ||
          key.endsWith(".telemetryAgeMinutes")
            ? { ...metric, value: null }
            : metric,
        ]),
    ),
  };
}

export function deterministicOverallState(
  snapshot: AnalyticsSnapshot,
): GeminiIntelligence["overallState"] {
  if (snapshot.signals.length === 0) return "HEALTHY";
  if (
    snapshot.signals.some(
      (signal) => signal.severity === "HIGH" || signal.severity === "MEDIUM",
    )
  ) return "ATTENTION_REQUIRED";
  if (
    snapshot.signals.every(
      (signal) =>
        signal.type === "INSUFFICIENT_SAMPLE" ||
        signal.type === "DATA_QUALITY_WARNING",
    )
  ) return "INSUFFICIENT_DATA";
  return "MIXED";
}

function numbersIn(text: string): number[] {
  return [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function supportedNumbers(
  snapshot: AnalyticsSnapshot,
  evidenceKeys: readonly string[],
  signalIds: readonly string[],
) {
  // Only values carried by referenced deterministic evidence may be stated as
  // operational facts. Zero and one remain available for ordinary singular /
  // absence wording without opening a catalogue of plausible-looking KPIs.
  const values = new Set<number>([0, 1]);
  for (const key of evidenceKeys) {
    const metric = snapshot.evidence[key];
    if (metric?.value !== null && metric?.value !== undefined) values.add(metric.value);
    if (metric) values.add(metric.sampleSize);
  }
  for (const id of signalIds) {
    const signal = snapshot.signals.find((item) => item.id === id);
    if (!signal) continue;
    for (const value of [
      signal.observedValue,
      signal.comparisonValue,
      signal.change,
      signal.sampleSize,
    ]) {
      if (value !== null) values.add(Math.abs(value));
    }
  }
  return values;
}

function numericClaimsAreGrounded(text: string, allowed: ReadonlySet<number>) {
  return numbersIn(text).every(
    (number) => allowed.has(number) || allowed.has(Math.abs(number)),
  );
}

export function validateGroundedIntelligence(
  intelligence: GeminiIntelligence,
  snapshot: AnalyticsSnapshot,
): GeminiIntelligence | null {
  const signalById = new Map(snapshot.signals.map((signal) => [signal.id, signal]));
  const requestedSignalIds = new Set(
    snapshot.signals.slice(0, 5).map((signal) => signal.id),
  );
  const receivedSignalIds = new Set<string>();
  if (intelligence.overallState !== deterministicOverallState(snapshot)) return null;
  for (const insight of intelligence.insights) {
    if (receivedSignalIds.has(insight.signalId)) return null;
    receivedSignalIds.add(insight.signalId);
    if (!requestedSignalIds.has(insight.signalId)) return null;
    const signal = signalById.get(insight.signalId);
    if (!signal) return null;
    if (
      insight.severity !== signal.severity ||
      insight.category !== signal.category ||
      insight.confidence !== signal.evidenceStrength
    ) return null;
    if (
      insight.evidenceMetricKeys.some(
        (key) =>
          !signal.evidenceMetricKeys.includes(key) || snapshot.evidence[key] === undefined,
      )
    ) return null;
    const allowed = supportedNumbers(
      snapshot,
      insight.evidenceMetricKeys,
      [insight.signalId],
    );
    if (
      !numericClaimsAreGrounded(
        [
          insight.headline,
          insight.observation,
          insight.interpretation,
          insight.recommendedReview ?? "",
          ...insight.limitations,
        ].join(" "),
        allowed,
      )
    ) return null;
  }
  const summaryEvidenceKeys = intelligence.insights.flatMap(
    (insight) => insight.evidenceMetricKeys,
  );
  const summarySignalIds = intelligence.insights.map(
    (insight) => insight.signalId,
  );
  if (
    !numericClaimsAreGrounded(
      intelligence.summary,
      supportedNumbers(snapshot, summaryEvidenceKeys, summarySignalIds),
    )
  ) return null;
  return {
    ...intelligence,
    insights: intelligence.insights.map((insight) => ({
      ...insight,
      // Recommendation level is selected by the deterministic signal engine.
      // Model prose must not escalate it into a stronger operational action.
      recommendedReview:
        signalById.get(insight.signalId)?.recommendedReview ?? null,
    })),
  };
}

export function validateGroundedAnswer(
  answer: AskIntelligenceAnswer,
  snapshot: AnalyticsSnapshot,
): AskIntelligenceAnswer | null {
  if (answer.evidenceMetricKeys.some((key) => snapshot.evidence[key] === undefined)) {
    return null;
  }
  if (answer.signalIds.some((id) => !snapshot.signals.some((signal) => signal.id === id))) {
    return null;
  }
  if (answer.suggestedAction?.lineId) {
    if (!snapshot.serviceLines.some((line) => line.lineId === answer.suggestedAction?.lineId)) {
      return null;
    }
  }
  if (answer.suggestedAction?.tripId) {
    if (!snapshot.tripEvidence.some((trip) => trip.tripId === answer.suggestedAction?.tripId)) {
      return null;
    }
  }
  const allowed = supportedNumbers(
    snapshot,
    answer.evidenceMetricKeys,
    answer.signalIds,
  );
  if (
    !numericClaimsAreGrounded(
      [answer.answer, ...answer.limitations].join(" "),
      allowed,
    )
  ) return null;
  return answer;
}
