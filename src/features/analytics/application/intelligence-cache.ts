import type { GeminiOperationsAdapter } from "./gemini-adapter";
import type {
  AnalyticsSnapshot,
  GeminiIntelligence,
} from "../contracts/intelligence.schemas";
import { validateGroundedIntelligence } from "../domain/gemini-grounding";

interface CacheEntry {
  readonly fingerprint: string;
  readonly model: string;
  readonly generatedAt: string;
  readonly period: AnalyticsSnapshot["period"];
  readonly value: GeminiIntelligence;
}

const MAX_CACHE_ENTRIES = 50;
const CACHE_TTL_MS = 6 * 60 * 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

function cacheKey(snapshot: AnalyticsSnapshot, model: string) {
  return `${model}:${snapshot.fingerprint}`;
}

function prune(now: number) {
  for (const [key, entry] of cache) {
    if (now - new Date(entry.generatedAt).getTime() > CACHE_TTL_MS) cache.delete(key);
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

export function readCachedIntelligence(input: {
  snapshot: AnalyticsSnapshot;
  enabled: boolean;
  model: string;
  adapterAvailable: boolean;
}) {
  if (!input.enabled) {
    return {
      interpretation: null,
      status: "DISABLED" as const,
      cached: false,
      message: "Gemini interpretation is disabled. Deterministic operational signals remain current.",
    };
  }
  if (!input.adapterAvailable) {
    return {
      interpretation: null,
      status: "UNAVAILABLE" as const,
      cached: false,
      message: "AI interpretation is unavailable. Deterministic operational signals remain current.",
    };
  }
  prune(Date.now());
  const existing = cache.get(cacheKey(input.snapshot, input.model));
  if (existing) {
    return {
      interpretation: existing.value,
      status: "READY" as const,
      cached: true,
      message: null,
    };
  }
  return {
    interpretation: null,
    status: "UPDATING" as const,
    cached: false,
    message: "Updating interpretation from the latest operational evidence…",
  };
}

export async function resolveCachedIntelligence(input: {
  snapshot: AnalyticsSnapshot;
  enabled: boolean;
  model: string;
  adapter?: GeminiOperationsAdapter;
}) {
  const cached = readCachedIntelligence({
    snapshot: input.snapshot,
    enabled: input.enabled,
    model: input.model,
    adapterAvailable: Boolean(input.adapter),
  });
  if (cached.status !== "UPDATING") return cached;
  const adapter = input.adapter;
  if (!adapter) return cached;
  const key = cacheKey(input.snapshot, input.model);
  try {
    let pending = inFlight.get(key);
    if (!pending) {
      pending = adapter.interpret(input.snapshot).then((candidate) => {
        const grounded = validateGroundedIntelligence(candidate, input.snapshot);
        if (!grounded) throw new Error("Gemini output failed grounding validation");
        const entry: CacheEntry = {
          fingerprint: input.snapshot.fingerprint,
          model: input.model,
          generatedAt: new Date().toISOString(),
          period: input.snapshot.period,
          value: grounded,
        };
        cache.set(key, entry);
        prune(Date.now());
        return entry;
      });
      inFlight.set(key, pending);
    }
    const entry = await pending;
    return {
      interpretation: entry.value,
      status: "READY" as const,
      cached: false,
      message: null,
    };
  } catch {
    return {
      interpretation: null,
      status: "UNAVAILABLE" as const,
      cached: false,
      message: "AI interpretation is temporarily unavailable. Deterministic operational signals remain current.",
    };
  } finally {
    inFlight.delete(key);
  }
}

export function intelligenceHistory() {
  prune(Date.now());
  return [...cache.values()]
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    .slice(0, 20)
    .map((entry) => ({
      fingerprint: entry.fingerprint,
      period: entry.period,
      model: entry.model,
      generatedAt: entry.generatedAt,
      headlines: entry.value.insights.map((insight) => insight.headline),
    }));
}

export function clearIntelligenceCacheForTests() {
  cache.clear();
  inFlight.clear();
}
