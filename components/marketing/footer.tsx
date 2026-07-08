import Link from "next/link";
import { DISCLAIMER } from "@/lib/compliance";

/**
 * Marketing footer. Renders the mandatory regulatory disclaimer verbatim from
 * lib/compliance.ts (single source of truth) on every public page.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800 mt-24">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
              </span>
              <span className="text-lg font-black bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent">
                OCTION
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Opérateur spécialisé dans le sourcing algorithmique des ventes aux
              enchères immobilières judiciaires en France.
            </p>
          </div>

          <nav className="flex flex-col sm:flex-row gap-8 text-sm">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
                Méthode
              </p>
              <Link href="/#methode" className="block text-slate-400 hover:text-white transition-colors">
                La méthode
              </Link>
              <Link href="/#realisations" className="block text-slate-400 hover:text-white transition-colors">
                Réalisations
              </Link>
              <Link href="/#villes" className="block text-slate-400 hover:text-white transition-colors">
                Enchères par ville
              </Link>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
                Accès
              </p>
              <Link href="/investisseur" className="block text-slate-400 hover:text-white transition-colors">
                Espace investisseur
              </Link>
              <Link href="/admin/login" className="block text-slate-400 hover:text-white transition-colors">
                Espace opérateur
              </Link>
            </div>
          </nav>
        </div>

        {/* Mandatory regulatory disclaimer */}
        <div className="border-t border-slate-800/80 pt-6">
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-3xl">
            {DISCLAIMER}
          </p>
          <p className="text-[11px] text-slate-600 mt-3">
            © {new Date().getFullYear()} OCTION · Données licitor.com normalisées
            · DVF CEREMA. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
