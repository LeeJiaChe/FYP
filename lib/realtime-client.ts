import "server-only";

import { serverEnvironment } from "@/shared/config/env.server";

/**
 * Server-side only utility to emit events to the standalone Socket.io realtime service.
 * This file must NEVER be imported in client components.
 * Uses REALTIME_URL (private, server-only) — not NEXT_PUBLIC_REALTIME_URL.
 */
export async function notifyRealtime(room: string, event: string, data: unknown) {
  try {
    const realtimeUrl = serverEnvironment.realtime.serviceUrl;
    const secret = serverEnvironment.realtime.serviceSecret;

    await fetch(`${realtimeUrl}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room,
        event,
        data,
        secret,
      }),
    });
  } catch (error) {
    // Fire-and-forget — realtime failure must never block the primary API response
    console.error("[Realtime Emit Error]", error);
  }
}
