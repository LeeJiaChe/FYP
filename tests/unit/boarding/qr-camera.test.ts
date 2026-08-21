import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  startQrCamera,
  verifyScannedPass,
} from "../../../src/features/boarding/ui/qr-camera";

describe("cross-browser QR camera adapter", () => {
  it("starts the library fallback when native BarcodeDetector is unavailable and cleans up", async () => {
    let decoded: ((result: { data: string }) => void) | undefined;
    let started = 0;
    let stopped = 0;
    let destroyed = 0;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { mediaDevices: { getUserMedia() {} } },
    });
    Object.defineProperty(globalThis, "BarcodeDetector", {
      configurable: true,
      value: undefined,
    });

    class FakeScanner {
      constructor(
        _video: HTMLVideoElement,
        onDecode: (result: { data: string }) => void,
      ) {
        decoded = onDecode;
      }
      async start() { started += 1; }
      stop() { stopped += 1; }
      destroy() { destroyed += 1; }
    }

    const tokens: string[] = [];
    const controller = await startQrCamera(
      {} as HTMLVideoElement,
      (token) => tokens.push(token),
      async () => ({ default: FakeScanner }),
    );
    decoded?.({ data: "signed-pass-token" });
    controller.stop();
    controller.stop();
    controller.destroy();

    assert.equal(started, 1);
    assert.deepEqual(tokens, ["signed-pass-token"]);
    assert.equal(stopped, 1, "cleanup stops the camera/media lifecycle once");
    assert.equal(destroyed, 1);
  });

  it("sends every decoded token to the existing server verification endpoint", async () => {
    let request: { url: string; body: string } | undefined;
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      request = { url: String(url), body: String(init?.body) };
      return new Response(JSON.stringify({ outcome: "RESERVED_ACCEPTED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await verifyScannedPass({
      fetcher,
      tripId: "trip-id",
      mode: "BOARDING",
      token: "signed-pass-token",
    });

    assert.equal(result.ok, true);
    assert.equal(request?.url, "/api/trips/trip-id/scan");
    assert.deepEqual(JSON.parse(request?.body ?? "{}"), {
      token: "signed-pass-token",
    });
  });

  it("releases a partially initialized camera when permission/startup fails", async () => {
    let stopped = 0;
    let destroyed = 0;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { mediaDevices: { getUserMedia() {} } },
    });
    class FailingScanner {
      async start() { throw new DOMException("Denied", "NotAllowedError"); }
      stop() { stopped += 1; }
      destroy() { destroyed += 1; }
    }

    await assert.rejects(
      startQrCamera(
        {} as HTMLVideoElement,
        () => undefined,
        async () => ({ default: FailingScanner }),
      ),
      (error: unknown) => error instanceof DOMException && error.name === "NotAllowedError",
    );
    assert.equal(stopped, 1);
    assert.equal(destroyed, 1);
  });
});
