import type {
  AnalyticsSnapshot,
  GeminiIntelligence,
} from "../contracts/intelligence.schemas";

export function buildExecutiveBrief(
  snapshot: AnalyticsSnapshot,
  interpretation: GeminiIntelligence | null,
): GeminiIntelligence["insights"] {
  const interpretationBySignal = new Map(
    interpretation?.insights.map((insight) => [insight.signalId, insight]) ?? [],
  );
  return snapshot.signals.slice(0, 5).map((signal) => {
    const enrichment = interpretationBySignal.get(signal.id);
    return {
      signalId: signal.id,
      severity: signal.severity,
      category: signal.category,
      headline: signal.headline,
      observation: signal.observation,
      interpretation:
        enrichment?.interpretation ?? signal.deterministicInterpretation,
      evidenceMetricKeys: [...signal.evidenceMetricKeys],
      recommendedReview: signal.recommendedReview,
      confidence: signal.evidenceStrength,
      limitations:
        signal.evidenceStrength === "LOW"
          ? ["Current sample is too small to establish a recurring trend."]
          : [],
    };
  });
}
