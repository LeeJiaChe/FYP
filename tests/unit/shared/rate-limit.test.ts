import assert from "node:assert/strict";
import { it } from "node:test";

import { RateLimiter, rateLimitClientKey } from "@/lib/rate-limit";

it("limits individual windows and releases bounded storage after expiry", () => {
  const limiter = new RateLimiter(100, 2, 1);
  assert.equal(limiter.check("first", 0), true);
  assert.equal(limiter.check("first", 1), true);
  assert.equal(limiter.check("first", 99), false);
  assert.equal(limiter.check("second", 99), false);
  assert.equal(limiter.check("second", 100), true);
});

it("accepts only one valid IP from the explicitly trusted ingress", () => {
  const headers = new Headers({ "x-forwarded-for": "192.0.2.1", "x-fyp-client-ip": "192.0.2.2" });
  assert.equal(rateLimitClientKey(headers, false), "unknown");
  assert.equal(rateLimitClientKey(headers, true), "192.0.2.2");
  headers.append("x-fyp-client-ip", "192.0.2.3");
  assert.equal(rateLimitClientKey(headers, true), "unknown");
});
