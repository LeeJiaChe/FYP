/**
 * Server-side only utility to emit events to the standalone Socket.io realtime service.
 * This file must NEVER be imported in client components.
 * Uses REALTIME_URL (private, server-only) — not NEXT_PUBLIC_REALTIME_URL.
 */
export async function notifyRealtime(room: string, event: string, data: any) {
  try {
    // Use a server-only env var (no NEXT_PUBLIC_ prefix) so the realtime URL is
    // never leaked into the client bundle. Falls back to localhost for local dev.
    const realtimeUrl = process.env.REALTIME_URL || "http://localhost:4000";
    const secret = process.env.REALTIME_SERVICE_SECRET;
    if (!secret) {
      console.error("[Realtime Emit] REALTIME_SERVICE_SECRET not set, skipping emit");
      return;
    }

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
