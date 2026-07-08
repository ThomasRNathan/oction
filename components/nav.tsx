"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";

const TABS = [
  { href: "/admin", label: "Analyser" },
  { href: "/admin/upcoming", label: "À venir" },
  { href: "/admin/historique", label: "Historique" },
  { href: "/admin/calculateur", label: "Calculateur" },
] as const;

/**
 * Admin tool nav. Mounted by app/admin/layout.tsx above every /admin route
 * (the public marketing site has its own header). Includes sign-out.
 */
export function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0f1a]/80 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex-shrink-0 group flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          <span className="text-xl font-black bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent group-hover:brightness-110 transition">
            OCTION
          </span>
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 ml-1">
            Admin
          </span>
        </Link>

        <nav className="flex gap-2 overflow-x-auto scrollbar-none">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm shadow-orange-500/20 transition-all whitespace-nowrap"
                    : "px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all whitespace-nowrap"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <form action={signOutAction} className="ml-auto flex-shrink-0">
          <button
            type="submit"
            className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all whitespace-nowrap"
          >
            Déconnexion
          </button>
        </form>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
    </header>
  );
}
