import "server-only";

import type { EtaFallbackReason, TripEta } from "../contracts/eta.schemas";

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAtMs: number;
}

export class EtaMemoryCache {
  private readonly etaStore = new Map<string, CacheEntry<TripEta>>();
  private readonly failureStore = new Map<
    string,
    CacheEntry<EtaFallbackReason>
  >();
  private readonly inFlightStore = new Map<string, Promise<TripEta>>();

  getCachedTripEta(tripId: string, nowMs: number): TripEta | null {
    const entry = this.etaStore.get(tripId);
    if (!entry) return null;
    if (nowMs >= entry.expiresAtMs) {
      this.etaStore.delete(tripId);
      return null;
    }
    return entry.value;
  }

  setCachedTripEta(
    tripId: string,
    eta: TripEta,
    ttlMs: number,
    nowMs: number,
  ): void {
    this.etaStore.set(tripId, {
      value: eta,
      expiresAtMs: nowMs + ttlMs,
    });
  }

  getCachedFailureReason(
    tripId: string,
    nowMs: number,
  ): EtaFallbackReason | null {
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
    reason: EtaFallbackReason,
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
    this.etaStore.clear();
    this.failureStore.clear();
    this.inFlightStore.clear();
  }
}

export const sharedEtaCache = new EtaMemoryCache();
