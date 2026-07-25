export async function notifyRealtime(room: string, event: string, data: any) {
  try {
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
    const secret = process.env.REALTIME_SERVICE_SECRET || "fyp-realtime-secret-key";

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
    console.error("[Realtime Emit Error]", error);
  }
}
