import type { AnalyticsSnapshot } from "../contracts/intelligence.schemas";

export const APPROVED_ANALYTICS_TOOL_NAMES = [
  "getNetworkPerformance",
  "getServiceLinePerformance",
  "getDemandPressure",
  "getReliabilityBreakdown",
  "getCapacityEvidence",
  "getFleetUtilisation",
  "getPassengerBehaviour",
  "getOriginDestinationDemand",
  "getSignalEvidence",
] as const;

export type ApprovedAnalyticsToolName =
  (typeof APPROVED_ANALYTICS_TOOL_NAMES)[number];

const noParameters = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const optionalLineScope = {
  type: "object",
  properties: { lineId: { type: "string" } },
  additionalProperties: false,
} as const;

export const analyticsToolDeclarations = [
  {
    name: "getNetworkPerformance",
    description: "Get deterministic network-wide operational performance.",
    parametersJsonSchema: noParameters,
  },
  ...[
    "getServiceLinePerformance",
    "getDemandPressure",
    "getReliabilityBreakdown",
    "getCapacityEvidence",
    "getOriginDestinationDemand",
  ].map((name) => ({
    name,
    description: `Get the read-only deterministic ${name} view, optionally scoped to a known Service Line ID.`,
    parametersJsonSchema: optionalLineScope,
  })),
  {
    name: "getFleetUtilisation",
    description: "Get Trip-derived physical Bus workload and transition advisories.",
    parametersJsonSchema: noParameters,
  },
  {
    name: "getPassengerBehaviour",
    description: "Get aggregated passenger behaviour without passenger identity.",
    parametersJsonSchema: noParameters,
  },
  {
    name: "getSignalEvidence",
    description: "Get one deterministic signal and its referenced evidence metrics.",
    parametersJsonSchema: {
      type: "object",
      properties: { signalId: { type: "string" } },
      required: ["signalId"],
      additionalProperties: false,
    },
  },
] as const;

export function executeReadOnlyAnalyticsTool(
  snapshot: AnalyticsSnapshot,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
): unknown {
  if (!APPROVED_ANALYTICS_TOOL_NAMES.includes(name as ApprovedAnalyticsToolName)) {
    throw new Error("Analytics tool is not approved");
  }
  const lineId = typeof args.lineId === "string" ? args.lineId : undefined;
  const line = lineId
    ? snapshot.serviceLines.find((item) => item.lineId === lineId)
    : undefined;
  if (lineId && !line) throw new Error("Unknown Service Line scope");

  switch (name as ApprovedAnalyticsToolName) {
    case "getNetworkPerformance":
      return snapshot.network;
    case "getServiceLinePerformance":
      return line ?? snapshot.serviceLines;
    case "getDemandPressure":
      return {
        demand: lineId
          ? snapshot.demand.filter((item) => item.lineId === lineId)
          : snapshot.demand,
        timeBuckets: lineId
          ? snapshot.timeBuckets.filter((item) => item.lineId === lineId)
          : snapshot.timeBuckets,
      };
    case "getReliabilityBreakdown":
      return lineId
        ? snapshot.reliability.byLine.filter((item) => item.lineId === lineId)
        : snapshot.reliability;
    case "getCapacityEvidence":
      return {
        demand: lineId
          ? snapshot.demand.filter((item) => item.lineId === lineId)
          : snapshot.demand,
        segmentLoads: lineId
          ? snapshot.segmentLoads.filter((item) => item.lineId === lineId)
          : snapshot.segmentLoads,
      };
    case "getFleetUtilisation":
      return snapshot.fleet;
    case "getPassengerBehaviour":
      return snapshot.passengerBehaviour;
    case "getOriginDestinationDemand":
      return lineId
        ? snapshot.originDestination.filter((item) => item.lineId === lineId)
        : snapshot.originDestination;
    case "getSignalEvidence": {
      const signalId = typeof args.signalId === "string" ? args.signalId : "";
      const signal = snapshot.signals.find((item) => item.id === signalId);
      if (!signal) throw new Error("Unknown signal");
      return {
        signal,
        evidence: signal.evidenceMetricKeys.map((key) => snapshot.evidence[key]),
      };
    }
  }
}
