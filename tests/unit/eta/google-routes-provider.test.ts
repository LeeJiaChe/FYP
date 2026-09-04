import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GoogleRoutesTrafficProvider,
  TrafficProviderError,
} from "../../../src/features/eta/infrastructure/google-routes.server";

const request = {
  origin: { latitude: 3.21, longitude: 101.72 },
  destination: { latitude: 3.23, longitude: 101.74 },
  intermediates: [{ latitude: 3.22, longitude: 101.73 }],
};

function validRoute() {
  return {
    duration: "240s",
    staticDuration: "200s",
    distanceMeters: 2_000,
    legs: [
      { duration: "120s", staticDuration: "100s", distanceMeters: 1_000 },
      { duration: "120s", staticDuration: "100s", distanceMeters: 1_000 },
    ],
  };
}

async function withFetchResponse(
  body: unknown,
  run: (provider: GoogleRoutesTrafficProvider) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  try {
    await run(new GoogleRoutesTrafficProvider("test-key"));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertProviderFailure(error: unknown, kind: TrafficProviderError["kind"]) {
  assert.ok(error instanceof TrafficProviderError);
  assert.equal(error.kind, kind);
  return true;
}

describe("Google Routes provider runtime validation", () => {
  it("accepts a complete route and exact leg count", async () => {
    await withFetchResponse({ routes: [validRoute()] }, async (provider) => {
      const result = await provider.computeRemainingTripRoute(request);
      assert.equal(result.durationSeconds, 240);
      assert.equal(result.staticDurationSeconds, 200);
      assert.equal(result.distanceMeters, 2_000);
      assert.equal(result.legs.length, 2);
    });
  });

  it("classifies an empty routes array as NO_ROUTE", async () => {
    await withFetchResponse({ routes: [] }, async (provider) => {
      await assert.rejects(
        provider.computeRemainingTripRoute(request),
        (error) => assertProviderFailure(error, "NO_ROUTE"),
      );
    });
  });

  it("rejects missing routes and malformed required route fields", async () => {
    const malformedBodies = [
      {},
      { routes: [{ ...validRoute(), duration: "not-a-duration" }] },
      { routes: [{ ...validRoute(), staticDuration: undefined }] },
      { routes: [{ ...validRoute(), distanceMeters: -1 }] },
      { routes: [{ ...validRoute(), distanceMeters: Number.NaN }] },
      { routes: [{ ...validRoute(), legs: undefined }] },
      {
        routes: [
          {
            ...validRoute(),
            legs: [
              { duration: "120s", staticDuration: undefined, distanceMeters: 1_000 },
              { duration: "120s", staticDuration: "100s", distanceMeters: 1_000 },
            ],
          },
        ],
      },
      {
        routes: [
          {
            ...validRoute(),
            legs: [
              { duration: "120s", staticDuration: "100s", distanceMeters: -1 },
              { duration: "120s", staticDuration: "100s", distanceMeters: 1_000 },
            ],
          },
        ],
      },
    ];

    for (const body of malformedBodies) {
      await withFetchResponse(body, async (provider) => {
        await assert.rejects(
          provider.computeRemainingTripRoute(request),
          (error) => assertProviderFailure(error, "INVALID_RESPONSE"),
        );
      });
    }
  });

  it("rejects both missing and extra legs", async () => {
    for (const legs of [validRoute().legs.slice(0, 1), [...validRoute().legs, validRoute().legs[0]!]]) {
      await withFetchResponse(
        { routes: [{ ...validRoute(), legs }] },
        async (provider) => {
          await assert.rejects(
            provider.computeRemainingTripRoute(request),
            (error) => assertProviderFailure(error, "INVALID_RESPONSE"),
          );
        },
      );
    }
  });

  it("uses typed HTTP_ERROR and NETWORK_ERROR failures", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response("failure", { status: 503 });
      await assert.rejects(
        new GoogleRoutesTrafficProvider("test-key").computeRemainingTripRoute(request),
        (error) => assertProviderFailure(error, "HTTP_ERROR"),
      );

      globalThis.fetch = async () => {
        throw new TypeError("network unavailable");
      };
      await assert.rejects(
        new GoogleRoutesTrafficProvider("test-key").computeRemainingTripRoute(request),
        (error) => assertProviderFailure(error, "NETWORK_ERROR"),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
