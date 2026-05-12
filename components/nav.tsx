"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserChip } from "@/components/auth/user-chip";

const TABS = [
  { href: "/", label: "Analyser" },
  { href: "/historique", label: "Historique" },
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
        <Link href="/" className="flex-shrink-0">
          <span className="text-xl font-black bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent">
            OCTION
          </span>
        </Link>

        <nav className="flex gap-2">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  active
                    ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm transition-all"
                    : "px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* Right-aligned user chip — hidden when signed-out (the home page's
            AuthGate handles promotion in context). */}
        <div className="ml-auto">
          <UserChip />
        </div>
      </div>
    </header>
  );
}
