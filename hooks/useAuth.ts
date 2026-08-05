import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load user session");
        setUser(null);
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, setUser, fetchUser };
}
