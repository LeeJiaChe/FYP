import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GeminiOperationsAdapter } from "../../../src/features/analytics/application/gemini-adapter";
import {
  clearIntelligenceCacheForTests,
  resolveCachedIntelligence,
} from "../../../src/features/analytics/application/intelligence-cache";
import {
  askIntelligenceAnswerSchema,
  geminiIntelligenceSchema,
  type AnalyticsSignal,
  type AnalyticsSnapshot,
  type AskIntelligenceAnswer,
  type GeminiIntelligence,
} from "../../../src/features/analytics/contracts/intelligence.schemas";
import {
  buildGeminiContext,
  validateGroundedAnswer,
  validateGroundedIntelligence,
} from "../../../src/features/analytics/domain/gemini-grounding";
import {
  APPROVED_ANALYTICS_TOOL_NAMES,
  analyticsToolDeclarations,
  executeReadOnlyAnalyticsTool,
} from "../../../src/features/analytics/domain/read-only-tools";

const signal: AnalyticsSignal = {
  id: "capacity-pressure-verified",
  type: "CAPACITY_PRESSURE",
  severity: "HIGH",
  category: "CAPACITY",
  scope: { lineId: "line-1", lineCode: "TERATAI" },
  headline: "TERATAI capacity pressure",
  observation: "Reserved segment utilisation is 92%.",
  deterministicInterpretation: "Demand is pressing against capacity.",
  recommendedReview: "Review the peak timetable.",
  recommendationLevel: "CONSIDER",
  observedValue: 92,
  comparisonValue: 81,
  change: 11,
  sampleSize: 8,
  evidenceStrength: "MEDIUM",
  evidenceMetricKeys: ["line.line-1.utilisation"],
  period: { from: "2026-09-01T00:00:00Z", to: "2026-09-08T00:00:00Z" },
};

function snapshot(fingerprint = "fingerprint-one"): AnalyticsSnapshot {
  return {
    period: { ...signal.period, timezone: "Asia/Kuala_Lumpur" },
    comparisonPeriod: { from: "2026-08-25T00:00:00Z", to: signal.period.from },
    generatedAt: "2026-09-08T00:00:00Z",
    fingerprint,
    eligibleTripCount: 8,
    dataQuality: {
      excludedAdministrativeCleanupTrips: 0,
      completedTripSamples: 8,
      actualDepartureSamples: 8,
      eligibleBookingOutcomes: 20,
      hasSufficientReliabilitySample: true,
      hasSufficientNoShowSample: true,
      prototypeData: true,
      timezone: "Asia/Kuala_Lumpur",
      missingActualDepartureCount: 0,
      comparisonAvailable: true,
      limitations: ["Prototype aggregate data only."],
    },
    network: {
      current: { boardedPassengers: 24 } as AnalyticsSnapshot["network"]["current"],
      previous: { boardedPassengers: 20 } as AnalyticsSnapshot["network"]["previous"],
      changes: { boardedPassengers: 4 },
    },
    serviceLines: [{ lineId: "line-1", lineCode: "TERATAI" }] as unknown as AnalyticsSnapshot["serviceLines"],
    previousServiceLines: [],
    timeBuckets: [],
    originDestination: [],
    segmentLoads: [],
    reliability: { overview: {}, byLine: [] } as unknown as AnalyticsSnapshot["reliability"],
    demand: [],
    fleet: [],
    passengerBehaviour: {
      noShowRate: 5,
      eligibleBookingOutcomes: 20,
      waitlistPromotionRate: 60,
      finalizedWaitlistOutcomes: 10,
      boardedPassengers: 24,
      unservedDemand: 4,
    },
    tripEvidence: [],
    evidence: {
      "line.line-1.utilisation": {
        key: "line.line-1.utilisation",
        label: "TERATAI reserved seat-segment utilisation",
        value: 92,
        unit: "PERCENT",
        sampleSize: 8,
      },
    },
    signals: [signal],
    focusSignalId: signal.id,
  };
}

function interpretation(): GeminiIntelligence {
  return {
    summary: "Capacity review is warranted.",
    overallState: "ATTENTION_REQUIRED",
    insights: [{
      signalId: signal.id,
      severity: signal.severity,
      category: signal.category,
      headline: "TERATAI capacity pressure at 92%",
      observation: "Verified utilisation is 92% across 8 Trips.",
      interpretation: "The pattern is consistent with capacity pressure.",
      evidenceMetricKeys: [...signal.evidenceMetricKeys],
      recommendedReview: "Review the 8 Trip sample before considering changes.",
      confidence: signal.evidenceStrength,
      limitations: [],
    }],
  };
}

describe("Gemini Operations Intelligence security and grounding", () => {
  it("builds an aggregated context without passenger PII fields", () => {
    const context = JSON.stringify(buildGeminiContext(snapshot()));
    assert.doesNotMatch(context, /studentId|student email|@student|password|appeal/i);
    assert.match(context, /TERATAI/);
  });

  it("accepts structured grounded output and rejects unknown evidence or signals", () => {
    const valid = interpretation();
    assert.ok(validateGroundedIntelligence(valid, snapshot()));
    assert.equal(
      validateGroundedIntelligence({
        ...valid,
        insights: [{ ...valid.insights[0]!, signalId: "unknown" }],
      }, snapshot()),
      null,
    );
    assert.equal(
      validateGroundedIntelligence({
        ...valid,
        insights: [{ ...valid.insights[0]!, evidenceMetricKeys: ["unknown.metric"] }],
      }, snapshot()),
      null,
    );
  });

  it("rejects unsupported numerical claims even when evidence references exist", () => {
    const valid = interpretation();
    assert.equal(
      validateGroundedIntelligence({
        ...valid,
        insights: [{ ...valid.insights[0]!, observation: "Utilisation increased by 23%." }],
      }, snapshot()),
      null,
    );
    assert.equal(
      validateGroundedIntelligence({
        ...valid,
        insights: [{ ...valid.insights[0]!, interpretation: "On-time performance is 80%." }],
      }, snapshot()),
      null,
    );
  });

  it("keeps recommendation wording at the deterministic policy boundary", () => {
    const valid = interpretation();
    const grounded = validateGroundedIntelligence({
      ...valid,
      insights: [{ ...valid.insights[0]!, recommendedReview: "Immediately add buses." }],
    }, snapshot());
    assert.equal(grounded?.insights[0]?.recommendedReview, signal.recommendedReview);
  });

  it("fails schema parsing safely for malformed and invalid-enum output", () => {
    assert.equal(geminiIntelligenceSchema.safeParse({ summary: "missing" }).success, false);
    assert.equal(geminiIntelligenceSchema.safeParse({
      ...interpretation(),
      insights: [{ ...interpretation().insights[0], severity: "CRITICAL" }],
    }).success, false);
    assert.equal(askIntelligenceAnswerSchema.safeParse({ answer: "no evidence" }).success, false);
  });

  it("grounds Ask answers and validates suggested drill-down scopes", () => {
    const answer: AskIntelligenceAnswer = {
      answer: "TERATAI is at 92% utilisation across 8 Trips.",
      evidenceMetricKeys: ["line.line-1.utilisation"],
      signalIds: [signal.id],
      suggestedAction: { type: "FILTER_LINE", lineId: "line-1", direction: null, tripId: null },
      limitations: [],
    };
    assert.ok(validateGroundedAnswer(answer, snapshot()));
    assert.equal(validateGroundedAnswer({ ...answer, evidenceMetricKeys: ["unknown"] }, snapshot()), null);
  });

  it("exposes only approved read-only analytics functions", () => {
    assert.ok(APPROVED_ANALYTICS_TOOL_NAMES.includes("getNetworkPerformance"));
    assert.equal(APPROVED_ANALYTICS_TOOL_NAMES.some((name) => /create|cancel|edit|assign|penal/i.test(name)), false);
    assert.deepEqual(executeReadOnlyAnalyticsTool(snapshot(), "getNetworkPerformance"), snapshot().network);
    assert.throws(() => executeReadOnlyAnalyticsTool(snapshot(), "createTrip"), /not approved/);
    const signalTool = analyticsToolDeclarations.find((tool) => tool.name === "getSignalEvidence");
    assert.ok(signalTool && "required" in signalTool.parametersJsonSchema);
    assert.deepEqual(signalTool.parametersJsonSchema.required, ["signalId"]);
    assert.equal(
      analyticsToolDeclarations.some((tool) =>
        "properties" in tool.parametersJsonSchema && "studentId" in tool.parametersJsonSchema.properties
      ),
      false,
    );
  });
});

describe("Gemini application cache and failure modes", () => {
  it("coalesces the same fingerprint and creates a new result after meaningful change", async () => {
    clearIntelligenceCacheForTests();
    let calls = 0;
    const adapter: GeminiOperationsAdapter = {
      async interpret() { calls += 1; return interpretation(); },
      async answer() { throw new Error("not used"); },
    };
    const [first, second] = await Promise.all([
      resolveCachedIntelligence({ snapshot: snapshot(), enabled: true, model: "model", adapter }),
      resolveCachedIntelligence({ snapshot: snapshot(), enabled: true, model: "model", adapter }),
    ]);
    const reused = await resolveCachedIntelligence({ snapshot: snapshot(), enabled: true, model: "model", adapter });
    const changed = await resolveCachedIntelligence({ snapshot: snapshot("fingerprint-two"), enabled: true, model: "model", adapter });
    assert.equal(first.status, "READY");
    assert.equal(second.status, "READY");
    assert.equal(reused.cached, true);
    assert.equal(changed.status, "READY");
    assert.equal(calls, 2);
  });

  it("keeps deterministic analytics available when disabled, missing, timed out, or invalid", async () => {
    clearIntelligenceCacheForTests();
    const disabled = await resolveCachedIntelligence({ snapshot: snapshot(), enabled: false, model: "model" });
    const missing = await resolveCachedIntelligence({ snapshot: snapshot(), enabled: true, model: "model" });
    const failing: GeminiOperationsAdapter = {
      async interpret() { throw new Error("timeout or quota"); },
      async answer() { throw new Error("not used"); },
    };
    const failed = await resolveCachedIntelligence({ snapshot: snapshot(), enabled: true, model: "model", adapter: failing });
    const invalid: GeminiOperationsAdapter = {
      async interpret() { return { ...interpretation(), insights: [{ ...interpretation().insights[0]!, signalId: "invented" }] }; },
      async answer() { throw new Error("not used"); },
    };
    const rejected = await resolveCachedIntelligence({ snapshot: snapshot("invalid"), enabled: true, model: "model", adapter: invalid });
    assert.equal(disabled.status, "DISABLED");
    assert.equal(missing.status, "UNAVAILABLE");
    assert.equal(failed.status, "UNAVAILABLE");
    assert.equal(rejected.status, "UNAVAILABLE");
  });
});
