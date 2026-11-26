import { isIP } from "node:net";

export class RateLimiter {
  private readonly store = new Map<string, { count: number; expiresAt: number }>();
  private nextSweep = 0;

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    private readonly capacity = 10_000,
  ) {}

  check(key: string, now = Date.now()): boolean {
    if (now >= this.nextSweep) {
      for (const [entry, record] of this.store) {
        if (now >= record.expiresAt) this.store.delete(entry);
      }
      this.nextSweep = now + Math.min(this.windowMs, 60_000);
    }

    const record = this.store.get(key);
    if (!record || now >= record.expiresAt) {
      if (!record && this.store.size >= this.capacity) return false;
      this.store.set(key, { count: 1, expiresAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) return false;
    record.count++;
    return true;
  }
}

/** The ingress must overwrite this header and prevent access around the proxy. */
export function rateLimitClientKey(headers: Headers, trustProxy = process.env.TRUST_FYP_CLIENT_IP === "true"): string {
  const address = trustProxy ? headers.get("x-fyp-client-ip")?.trim() : undefined;
  return address && isIP(address) ? address : "unknown";
}

export const loginRateLimiter = new RateLimiter(60_000, 25);
export const loginIdentifierRateLimiter = new RateLimiter(5 * 60_000, 10);
export const registerRateLimiter = new RateLimiter(60_000, 5);
export const resendVerificationRateLimiter = new RateLimiter(10 * 60_000, 5);
export const googleStudentLoginRateLimiter = new RateLimiter(10 * 60_000, 20);
export const googleStudentOnboardingRateLimiter = new RateLimiter(10 * 60_000, 10);
export const passwordResetRequestRateLimiter = new RateLimiter(15 * 60_000, 5);
export const passwordResetCompletionRateLimiter = new RateLimiter(15 * 60_000, 10);
export const askIntelligenceRateLimiter = new RateLimiter(60_000, 10);
export const interpretIntelligenceRateLimiter = new RateLimiter(60_000, 10);
