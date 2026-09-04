"use client";

import { useEffect, useState } from "react";

/**
 * A low-frequency presentation clock. Business mutations always revalidate
 * against the server clock; this hook only keeps labels and grouping current.
 */
export function useOperationalClock(refreshMs = 30_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);

  return nowMs;
}
