import "server-only";

import { serverEnvironment } from "@/shared/config/env.server";
import { isValidRealtimeEmission } from "@/shared/realtime/event-contract.js";

export type RealtimeEvent =
  | "trip.changed"
  | "occupancy.changed"
  | "location.changed"
  | "notification.changed";

export interface RealtimeInvalidation {
  readonly entityId: string;
  readonly changedAt: string;
  readonly reason?: string;
}

/**
 * Server-side only utility to emit events to the standalone Socket.io realtime service.
 * This file must NEVER be imported in client components.
 * Uses REALTIME_URL (private, server-only) — not NEXT_PUBLIC_REALTIME_URL.
 */
export async function notifyRealtime(
  room: string,
  event: RealtimeEvent,
  data: RealtimeInvalidation,
) {
  try {
    const realtimeUrl = serverEnvironment.realtime.serviceUrl;
    const secret = serverEnvironment.realtime.serviceSecret;

    if (!isValidRealtimeEmission(room, event, data)) {
      throw new TypeError("Invalid realtime emission contract");
    }
    const response = await fetch(`${realtimeUrl}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ room, event, data }),
    });
    if (!response.ok) throw new Error(`Realtime service returned ${response.status}`);
  } catch (error) {
    // Fire-and-forget — realtime failure must never block the primary API response
    console.error("[Realtime Emit Error]", error);
  }
}
