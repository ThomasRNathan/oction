import Link from "next/link";

/**
 * Public marketing header. The whole site funnels to a single CTA —
 * "Espace investisseur" (a gated contact form for self-declared avertis),
 * NOT a subscription.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0f1a]/80 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center gap-6">
        <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          <span className="text-xl font-black bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent group-hover:brightness-110 transition">
            OCTION
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/#methode" className="hover:text-white transition-colors">
            La méthode
          </Link>
          <Link href="/#realisations" className="hover:text-white transition-colors">
            Réalisations
          </Link>
          <Link href="/#villes" className="hover:text-white transition-colors">
            Enchères par ville
          </Link>
        </nav>

        <Link
          href="/investisseur"
          className="ml-auto flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-sm shadow-orange-500/20 transition-all whitespace-nowrap"
        >
          Espace investisseur
        </Link>
      </div>
    </header>
  );
}
