class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private store: Map<string, { count: number; expiresAt: number }>;

  constructor(windowMs: number = 60 * 1000, maxRequests: number = 5) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.store = new Map();
  }

  /**
   * Checks if a key has exceeded the rate limit.
   * @returns true if allowed, false if rate limited
   */
  public check(key: string): boolean {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record) {
      this.store.set(key, { count: 1, expiresAt: now + this.windowMs });
      return true;
    }

    if (now > record.expiresAt) {
      // Reset window
      this.store.set(key, { count: 1, expiresAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false; // Rate limited
    }

    record.count++;
    return true;
  }
}

// Global instances so they persist across requests in development/edge (where possible)
export const loginRateLimiter = new RateLimiter(60 * 1000, 100); // 100 attempts per minute for tests
export const registerRateLimiter = new RateLimiter(60 * 1000, 100); // 100 registrations per minute for tests
export const resendVerificationRateLimiter = new RateLimiter(10 * 60 * 1000, 5);
export const askIntelligenceRateLimiter = new RateLimiter(60 * 1000, 10);
export const interpretIntelligenceRateLimiter = new RateLimiter(60 * 1000, 10);
