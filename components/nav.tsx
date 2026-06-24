"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Analyser" },
  { href: "/upcoming", label: "À venir" },
  { href: "/historique", label: "Historique" },
  { href: "/calculateur", label: "Calculateur" },
] as const;

/**
 * Persistent top nav. Sits in `app/layout.tsx` above every route. Active link
 * uses the orange-gradient pill (matches the Analyser button on the search
 * form and the active card-mode tab); inactive links use the slate-700
 * outline pattern.
 */
export function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0f1a]/80 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="flex-shrink-0 group flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          <span className="text-xl font-black bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent group-hover:brightness-110 transition">
            OCTION
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

        <span className="hidden sm:block ml-auto text-[10px] text-slate-600">
          Enchères immobilières judiciaires
        </span>
      </div>
      {/* Hairline gradient under the bar — ties the brand color through every page. */}
      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
    </header>
  );
}
