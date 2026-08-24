"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application boundary caught an error", error.digest || error.name);
  }, [error]);

  return (
    <main className="portal-loading" role="alert">
      <div className="glass-card max-w-md space-y-4 rounded-2xl p-6 text-center">
        <h1 className="section-title">This page could not be loaded</h1>
        <p className="section-subtitle">Your data is safe. Check your connection and try again.</p>
        <button type="button" className="btn-primary" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
