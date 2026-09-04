import "server-only";

import type { TripEta } from "../contracts/eta.schemas";

export type EtaFailureThrottleReason =
  | "API_TIMEOUT"
  | "API_ERROR"
  | "NO_ROUTE";

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAtMs: number;
}

export class EtaMemoryCache {
  private readonly failureStore = new Map<
    string,
    CacheEntry<EtaFailureThrottleReason>
  >();
  private readonly inFlightStore = new Map<string, Promise<TripEta>>();

  getCachedFailureReason(
    tripId: string,
    nowMs: number,
  ): EtaFailureThrottleReason | null {
    const entry = this.failureStore.get(tripId);
    if (!entry) return null;
    if (nowMs >= entry.expiresAtMs) {
      this.failureStore.delete(tripId);
      return null;
    }
    return entry.value;
  }

  setCachedFailure(
    tripId: string,
    reason: EtaFailureThrottleReason,
    ttlMs: number,
    nowMs: number,
  ): void {
    this.failureStore.set(tripId, {
      value: reason,
      expiresAtMs: nowMs + ttlMs,
    });
  }

  getInFlight(tripId: string): Promise<TripEta> | undefined {
    return this.inFlightStore.get(tripId);
  }

  setInFlight(tripId: string, promise: Promise<TripEta>): void {
    this.inFlightStore.set(tripId, promise);
  }

  clearInFlight(tripId: string): void {
    this.inFlightStore.delete(tripId);
  }

  clearAll(): void {
    this.failureStore.clear();
    this.inFlightStore.clear();
  }
}

export const sharedEtaCache = new EtaMemoryCache();
