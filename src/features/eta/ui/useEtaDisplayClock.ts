"use client";

import { useEffect, useState } from "react";

export function useEtaDisplayClock(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return nowMs;
}

export function minutesUntil(estimatedArrival: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(estimatedArrival) - nowMs) / 60_000));
}
