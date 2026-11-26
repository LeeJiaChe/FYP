import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSameOriginMutation,
  requestPublicOrigin,
  type OriginRequest,
} from "../../../src/shared/http/origin-check";

function request(
  method: string,
  headers: Record<string, string>,
  url = "http://internal-next:3000/api/bookings",
): OriginRequest {
  return { method, headers: new Headers(headers), url };
}

describe("same-origin mutation protection", () => {
  it("accepts matching direct-host browser mutations", () => {
    assert.doesNotThrow(() =>
      assertSameOriginMutation(
        request("POST", {
          host: "localhost:3000",
          origin: "http://localhost:3000",
        }, "http://localhost:3000/api/bookings"),
      ),
    );
  });

  it("uses sanitized proxy host/protocol as the public origin", () => {
    const proxied = request("PATCH", {
      host: "internal-next:3000",
      origin: "https://shuttle.example.edu.my",
      "x-forwarded-host": "shuttle.example.edu.my",
      "x-forwarded-proto": "https",
    });

    assert.equal(requestPublicOrigin(proxied), "https://shuttle.example.edu.my");
    assert.doesNotThrow(() => assertSameOriginMutation(proxied));
  });

  it("rejects missing, null, invalid, and cross-origin mutation origins", () => {
    for (const origin of [
      undefined,
      "null",
      "not a URL",
      "https://evil.example",
    ]) {
      const headers: Record<string, string> = { host: "localhost:3000" };
      if (origin !== undefined) headers.origin = origin;
      assert.throws(
        () => assertSameOriginMutation(request("DELETE", headers)),
        /Origin|Cross-origin/,
      );
    }
  });

  it("does not require Origin for safe methods", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      assert.doesNotThrow(() =>
        assertSameOriginMutation(request(method, { host: "localhost:3000" })),
      );
    }
  });
});

it("uses the configured application origin in production regardless of forwarded headers", () => {
  const previous = process.env;
  try {
    process.env = { ...previous, NODE_ENV: "production", APP_BASE_URL: "https://shuttle.example.test" };
    const forwarded = { "x-forwarded-host": "untrusted.example.test", "x-forwarded-proto": "https" };
    assert.doesNotThrow(() => assertSameOriginMutation(request("POST", { ...forwarded, origin: "https://shuttle.example.test" })));
    assert.throws(() => assertSameOriginMutation(request("POST", { ...forwarded, origin: "https://untrusted.example.test" })), /Cross-origin/);
    delete process.env.APP_BASE_URL;
    assert.throws(() => assertSameOriginMutation(request("POST", { ...forwarded, origin: "https://shuttle.example.test" })), /unavailable/);
  } finally {
    process.env = previous;
  }
});
