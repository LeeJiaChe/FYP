import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { CurrentUser } from "@/shared/ui/current-user";

export function useCurrentUser(initialUser: CurrentUser | null = null) {
  const [user, setUser] = useState<CurrentUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  const fetchUser = useCallback(async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to load user session");
        setUser(null);
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    if (initialUser) return;
    const timeout = window.setTimeout(() => void fetchUser(), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchUser, initialUser]);

  return { user, loading, setUser, fetchUser };
}
