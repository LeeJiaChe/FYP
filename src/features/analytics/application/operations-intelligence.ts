import type { OperationsAnalyticsQuery } from "../contracts/analytics.schemas";
import type {
  AskIntelligenceAnswer,
  OperationsInterpretationResponse,
} from "../contracts/intelligence.schemas";
import { buildAnalyticsSnapshot } from "../domain/intelligence";
import { validateGroundedAnswer } from "../domain/gemini-grounding";
import { fetchOperationsAnalyticsRawData } from "../infrastructure/analytics.prisma.server";
import { GoogleGeminiOperationsAdapter } from "../infrastructure/google-gemini.server";
import { conflict, forbidden } from "@/shared/application/application-error";
import { serverEnvironment } from "@/shared/config/env.server";
import { systemClock, type Clock } from "@/shared/time/clock";
import type { GeminiOperationsAdapter } from "./gemini-adapter";
import {
  getOperationsAnalytics,
  resolveAnalyticsRange,
  type AnalyticsActor,
} from "./analytics";
import {
  intelligenceHistory,
  readCachedIntelligence,
  resolveCachedIntelligence,
} from "./intelligence-cache";

interface GeminiOperationsConfiguration {
  readonly enabled: boolean;
  readonly apiKey: string;
  readonly model: string;
}

interface IntelligenceRetrievalDependencies {
  readonly loadDeterministic?: typeof getDeterministicOperationsIntelligence;
  readonly configuration?: GeminiOperationsConfiguration;
  readonly createAdapter?: (
    configuration: GeminiOperationsConfiguration,
  ) => GeminiOperationsAdapter | undefined;
}

export async function getDeterministicOperationsIntelligence(
  actor: AnalyticsActor,
  query: OperationsAnalyticsQuery,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  const now = clock.now();
  const { from, to } = resolveAnalyticsRange(query, clock);
  const durationMs = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - durationMs);
  const previousTo = from;

  const previousQuery = {
    ...query,
    from: previousFrom,
    to: previousTo,
  };
  const [analytics, previous, currentRaw, currentExceptionRaw] = await Promise.all([
    getOperationsAnalytics(actor, { ...query, from, to }, clock),
    getOperationsAnalytics(actor, previousQuery, clock),
    fetchOperationsAnalyticsRawData(from, to, query.lineId, query.direction),
    fetchOperationsAnalyticsRawData(
      new Date(0),
      new Date(now.getTime() + 2 * 60 * 60_000),
      query.lineId,
      query.direction,
      ["NOT_STARTED", "BOARDING", "DEPARTED"],
    ),
  ]);

  return {
    analytics,
    snapshot: buildAnalyticsSnapshot({
      current: analytics,
      previous,
      currentRaw,
      currentExceptionTrips: currentExceptionRaw.trips,
      now,
    }),
  };
}

function configuredAdapter(
  configuration: GeminiOperationsConfiguration = serverEnvironment.geminiOperations,
) {
  return configuration.enabled && configuration.apiKey
    ? new GoogleGeminiOperationsAdapter(configuration.apiKey, configuration.model)
    : undefined;
}

export async function getOperationsIntelligence(
  actor: AnalyticsActor,
  query: OperationsAnalyticsQuery,
  clock: Clock = systemClock,
  dependencies: IntelligenceRetrievalDependencies = {},
) {
  const loadDeterministic =
    dependencies.loadDeterministic ?? getDeterministicOperationsIntelligence;
  const deterministic = await loadDeterministic(
    actor,
    query,
    clock,
  );
  const configuration =
    dependencies.configuration ?? serverEnvironment.geminiOperations;
  const resolved = readCachedIntelligence({
    snapshot: deterministic.snapshot,
    enabled: configuration.enabled,
    model: configuration.model,
    adapterAvailable: Boolean(configuration.apiKey),
  });
  return {
    ...deterministic,
    interpretation: resolved.interpretation,
    assistant: {
      status: resolved.status,
      model: configuration.enabled ? configuration.model : null,
      cached: resolved.cached,
      message: resolved.message,
    },
    history: intelligenceHistory(),
  };
}

export async function interpretOperationsIntelligence(
  actor: AnalyticsActor,
  input: OperationsAnalyticsQuery & { fingerprint: string },
  clock: Clock = systemClock,
  dependencies: IntelligenceRetrievalDependencies = {},
): Promise<OperationsInterpretationResponse> {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  const loadDeterministic =
    dependencies.loadDeterministic ?? getDeterministicOperationsIntelligence;
  const deterministic = await loadDeterministic(actor, input, clock);
  if (deterministic.snapshot.fingerprint !== input.fingerprint) {
    throw conflict(
      "Operational evidence changed; refresh Analytics before requesting interpretation",
    );
  }
  const configuration =
    dependencies.configuration ?? serverEnvironment.geminiOperations;
  const createAdapter = dependencies.createAdapter ?? configuredAdapter;
  const resolved = await resolveCachedIntelligence({
    snapshot: deterministic.snapshot,
    enabled: configuration.enabled,
    model: configuration.model,
    adapter: createAdapter(configuration),
  });
  return {
    fingerprint: deterministic.snapshot.fingerprint,
    interpretation: resolved.interpretation,
    assistant: {
      status: resolved.status,
      model: configuration.enabled ? configuration.model : null,
      cached: resolved.cached,
      message: resolved.message,
    },
    history: intelligenceHistory(),
  };
}

export async function askOperationsIntelligence(
  actor: AnalyticsActor,
  input: OperationsAnalyticsQuery & { question: string },
  clock: Clock = systemClock,
): Promise<AskIntelligenceAnswer> {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  const configuration = serverEnvironment.geminiOperations;
  const adapter = configuredAdapter(configuration);
  if (!configuration.enabled || !adapter) {
    throw new Error("Operations Intelligence assistant is unavailable");
  }
  const deterministic = await getDeterministicOperationsIntelligence(
    actor,
    input,
    clock,
  );
  const candidate = await adapter.answer(input.question, deterministic.snapshot);
  const grounded = validateGroundedAnswer(candidate, deterministic.snapshot);
  if (!grounded) throw new Error("Gemini answer failed grounding validation");
  return grounded;
}
