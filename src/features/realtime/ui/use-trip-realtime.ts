"use client";

import { useEffect, useEffectEvent } from "react";
import { io } from "socket.io-client";

type TripEvent = "occupancy.changed" | "location.changed" | "trip.changed";

export function useTripRealtime(
  tripId: string | null,
  onInvalidate: (event: TripEvent | "connect") => void,
) {
  const invalidate = useEffectEvent(onInvalidate);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!tripId || !url) return;

    const controller = new AbortController();
    const socket = io(url, {
      autoConnect: false,
      auth: (provideToken) => {
        void fetch("/api/realtime/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId }),
          signal: controller.signal,
        }).then(async (response) => {
          if (!response.ok) return provideToken({});
          const { token } = await response.json();
          if (!controller.signal.aborted) provideToken({ token });
        }).catch(() => {
          if (!controller.signal.aborted) provideToken({});
        });
      },
    });

    socket.on("connect", () => invalidate("connect"));
    socket.on("occupancy.changed", () => invalidate("occupancy.changed"));
    socket.on("trip.changed", () => invalidate("trip.changed"));
    socket.on("location.changed", () => invalidate("location.changed"));
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") socket.connect();
    });
    socket.connect();

    return () => {
      controller.abort();
      socket.disconnect();
    };
  }, [tripId]);
}
