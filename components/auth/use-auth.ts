"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/auth/browser";
import type { User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "signed-in" | "signed-out";

export interface AuthState {
  status: AuthStatus;
  user: User | null;
}

/**
 * Reactive auth state for client components.
 *
 * - Starts "loading" while we ask Supabase for the current session.
 * - Subscribes to `onAuthStateChange` so other tabs / the callback redirect
 *   propagate immediately.
 * - Unsubscribes on unmount.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user ?? null);
      setStatus(data.user ? "signed-in" : "signed-out");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "signed-in" : "signed-out");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { status, user };
}
