"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

interface GoogleCredentialResponse {
  readonly credential: string;
}

interface GoogleAccountsId {
  initialize(input: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    hd?: string;
    auto_select?: boolean;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "rectangular";
      logo_alignment: "left";
      width: number;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

export function GoogleStudentButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [configuration, setConfiguration] = useState<{
    clientId: string;
    hostedDomain: string;
    configured: boolean;
  } | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/google/student/config")
      .then(async (response) => {
        if (!response.ok) throw new Error("configuration unavailable");
        return response.json();
      })
      .then((value) => {
        if (active) setConfiguration(value);
      })
      .catch(() => {
        if (active) {
          setConfiguration({ clientId: "", hostedDomain: "", configured: false });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCredential = useCallback(async (response: GoogleCredentialResponse) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fetch("/api/auth/google/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const body = await result.json();
      if (!result.ok) {
        setError(body.error ?? "Google sign-in failed. Please try again.");
        return;
      }
      window.location.href = body.requiresOnboarding
        ? "/register/complete"
        : "/student";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (
      !scriptReady ||
      !configuration?.configured ||
      !containerRef.current ||
      !window.google
    ) {
      return;
    }
    const container = containerRef.current;
    container.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: configuration.clientId,
      callback: handleCredential,
      hd: configuration.hostedDomain,
      auto_select: false,
    });
    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: Math.min(360, Math.max(240, container.clientWidth)),
    });
  }, [configuration, handleCredential, scriptReady]);

  return (
    <div className="space-y-3">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setError("Google sign-in could not be loaded.")}
      />
      {configuration === null ? (
        <div className="btn-secondary w-full" aria-live="polite">
          Loading Google sign-in…
        </div>
      ) : configuration.configured ? (
        <div
          className={`flex min-h-11 justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}
          aria-busy={busy}
          ref={containerRef}
        />
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Google Student sign-in is not configured on this environment.
        </div>
      )}
      {busy && (
        <p className="text-center text-xs text-[var(--text-secondary)]" aria-live="polite">
          Verifying your TAR UMT Google account…
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
