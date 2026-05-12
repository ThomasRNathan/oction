"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/use-auth";
import { getBrowserSupabase } from "@/lib/auth/browser";

/**
 * Small auth chip for the global Nav.
 *
 *   - "loading" / "signed-out"  → nothing rendered (the home page's AuthGate
 *     handles signed-out promotion in context).
 *   - "signed-in" → email initial avatar with popover (full email + sign-out).
 *
 * Designed to fit the Nav's compact slot; no layout shift when auth resolves.
 */
export function UserChip() {
  const { status, user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "signed-in" || !user?.email) return null;

  const initial = user.email[0]?.toUpperCase() ?? "?";

  const onSignOut = async () => {
    try {
      await getBrowserSupabase().auth.signOut();
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white text-xs font-bold flex items-center justify-center hover:ring-2 hover:ring-orange-500/40 transition-all"
        title={user.email}
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-xl p-3 z-50"
        >
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Connecté en tant que
          </p>
          <p className="text-sm text-white truncate mb-2">{user.email}</p>
          <button
            type="button"
            onClick={onSignOut}
            role="menuitem"
            className="w-full px-2 py-1.5 text-left text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
