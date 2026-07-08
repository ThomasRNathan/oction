import type { Metadata } from "next";
import Link from "next/link";
import { getAllVilles, getFeaturedVilles } from "@/lib/tribunaux";
import { TRI_PHRASING } from "@/lib/compliance";
import { HeroVisual } from "@/components/marketing/hero-visual";

export const metadata: Metadata = {
  title: "Sourcing algorithmique d'enchères immobilières judiciaires",
  description:
    "OCTION détecte et sélectionne les ventes aux enchères immobilières judiciaires en France par une méthode propriétaire de sourcing algorithmique : indexation continue, enrichissement DVF, scoring de la décote et due diligence.",
  alternates: { canonical: "/" },
};

const STATS = [
  { value: "22 000+", label: "ventes judiciaires analysées" },
  { value: `${getAllVilles().length}`, label: "tribunaux couverts" },
  { value: "DVF", label: "données foncières officielles" },
];

const METHODE = [
  {
    n: "01",
    title: "Indexation continue",
    body: "Chaque vente sur saisie immobilière publiée est captée et historisée en continu — cahiers des conditions, mises à prix, dates d'audience, tribunal compétent.",
  },
  {
    n: "02",
    title: "Enrichissement",
    body: "Adresses géocodées, types de biens normalisés, croisement systématique avec les valeurs foncières DVF (CEREMA) pour estimer le prix de marché au m² du secteur.",
  },
  {
    n: "03",
    title: "Scoring",
    body: "Chaque lot est noté : décote de la mise à prix vs marché, liquidité locale, attractivité, probabilité de passage sans surenchère — pour extraire le signal du bruit.",
  },
  {
    n: "04",
    title: "Sélection",
    body: "Les lots à plus fort potentiel passent une revue humaine : lecture du cahier des conditions, contraintes (occupation, baux, charges), coût d'acquisition tout compris.",
  },
];

// Case-study PLACEHOLDERS — structure to fill with real, documented operations.
// Returns are never guaranteed; any target uses the compliant TRI phrasing.
const REALISATIONS = [
  {
    bien: "Appartement 3 pièces · Paris 18e",
    decote: "−38 %",
    issue: "Revente après travaux · horizon ~14 mois",
  },
  {
    bien: "Immeuble de rapport · Bobigny (93)",
    decote: "−31 %",
    issue: "Conservation locative · mise en gestion",
  },
  {
    bien: "Local commercial loué · Lille (59)",
    decote: "−27 %",
    issue: "Bail commercial en place · rendement locatif",
  },
];

export default function LandingPage() {
  const featured = getFeaturedVilles(12);
  const totalVilles = getAllVilles().length;

  return (
    <main className="relative">
      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-4 pt-16 md:pt-24 pb-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-medium mb-6 animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Opérateur en sourcing d&apos;enchères judiciaires
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.03] text-balance animate-fade-up">
              Le sourcing{" "}
              <span className="text-gradient gradient-animate">algorithmique</span>{" "}
              des ventes judiciaires immobilières
            </h1>

            <p className="text-lg text-slate-400 max-w-xl mt-6 mb-8 leading-relaxed animate-fade-up">
              Une méthode propriétaire pour détecter, noter et sélectionner les
              lots aux enchères sur saisie immobilière en France — là où la
              décote à l&apos;entrée se construit, lot par lot.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 animate-fade-up">
              <Link
                href="/investisseur"
                className="px-7 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/20 transition-all text-center"
              >
                Espace investisseur →
              </Link>
              <Link
                href="/#methode"
                className="px-7 py-3.5 border border-slate-700 text-slate-300 font-medium rounded-xl hover:border-slate-500 hover:text-white hover:bg-white/[0.02] transition-all text-center"
              >
                Découvrir la méthode
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-stretch gap-6 mt-12 animate-fade-up">
              {STATS.map((s, i) => (
                <div key={s.label} className="flex items-stretch gap-6">
                  {i > 0 && <div className="w-px bg-slate-800" />}
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-white tabular-nums leading-none">
                      {s.value}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1.5 max-w-[9rem]">
                      {s.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div className="relative animate-fade-up">
            <div className="relative rounded-3xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-sm ring-gradient-on p-4 float-slow">
              <HeroVisual className="w-full h-auto" />
              <div className="absolute bottom-6 left-6 flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.7)]" />
                  Lots sélectionnés
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  Flux des ventes
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LA MÉTHODE (pipeline) ── */}
      <section id="methode" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400 mb-3">
            La méthode
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-balance">
            Du flux brut au lot sélectionné
          </h2>
          <p className="text-slate-400 mt-4 leading-relaxed">
            Le marché des enchères judiciaires est opaque et dispersé. Notre
            chaîne de traitement transforme un flux d&apos;annonces hétérogènes en
            une liste courte de lots qualifiés.
          </p>
        </div>

        <div className="relative">
          {/* connecting line (desktop) */}
          <div className="hidden lg:block absolute top-6 left-8 right-8 h-px bg-gradient-to-r from-transparent via-slate-700/70 to-transparent" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
            {METHODE.map((m) => (
              <div key={m.n} className="relative">
                <div className="relative z-10 h-12 w-12 rounded-full bg-[#0a0f1a] border border-slate-700 flex items-center justify-center mb-4">
                  <span className="text-sm font-black text-gradient">{m.n}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{m.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RÉALISATIONS ── */}
      <section id="realisations" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400 mb-3">
            Réalisations
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-balance">
            Des opérations documentées
          </h2>
          <p className="text-slate-400 mt-4 leading-relaxed">
            Exemples illustratifs de la nature des opérations sourcées — chaque
            fiche est un emplacement à compléter avec une opération réelle et ses
            pièces.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {REALISATIONS.map((r, i) => (
            <article
              key={i}
              className="group relative rounded-2xl border border-slate-800 bg-slate-900/30 ring-gradient p-6 flex flex-col transition-colors"
            >
              <span className="text-[10px] uppercase tracking-wider text-slate-600 border border-slate-800 rounded px-2 py-0.5 self-start mb-6">
                Étude de cas — à compléter
              </span>
              <p className="text-6xl font-black text-gradient tabular-nums leading-none mb-1">
                {r.decote}
              </p>
              <p className="text-[11px] text-slate-500 mb-6">
                décote à l&apos;entrée vs prix de marché (DVF)
              </p>

              <div className="mt-auto space-y-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">Bien</p>
                  <p className="text-slate-200">{r.bien}</p>
                </div>
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">Issue</p>
                  <p className="text-slate-300">{r.issue}</p>
                </div>
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">
                    Performance visée
                  </p>
                  <p className="text-xs text-slate-400">{TRI_PHRASING}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="text-[11px] text-slate-600 mt-6 max-w-2xl">
          Exemples illustratifs, non contractuels. Les performances passées ne
          préjugent pas des performances futures.
        </p>
      </section>

      {/* ── SEO HUB ── */}
      <section id="villes" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400 mb-3">
            Couverture
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-balance">
            Les enchères judiciaires, ville par ville
          </h2>
          <p className="text-slate-400 mt-4 leading-relaxed">
            {totalVilles} ressorts de tribunaux judiciaires suivis. Explorez le
            marché des ventes sur saisie immobilière près de chez vous.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {featured.map((v) => (
            <Link
              key={v.slug}
              href={`/encheres/${v.slug}`}
              className="group relative rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-4 ring-gradient hover:bg-slate-900/60 transition-all"
            >
              <p className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors flex items-center justify-between">
                {v.ville}
                <span className="text-slate-600 group-hover:text-orange-400 transition-all group-hover:translate-x-0.5">
                  →
                </span>
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                {v.stats.total.toLocaleString("fr-FR")} ventes suivies
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-orange-500/20 p-10 md:p-16 text-center bg-gradient-to-br from-orange-500/[0.14] via-orange-500/[0.04] to-transparent">
          <div className="absolute inset-0 bg-dotgrid opacity-40" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 text-balance">
              Accéder à l&apos;espace investisseur
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
              Un espace réservé aux investisseurs avertis. Présentez votre profil
              et vos critères ; nous revenons vers vous sur les dossiers
              éligibles. Aucun abonnement, aucune souscription en ligne.
            </p>
            <Link
              href="/investisseur"
              className="inline-block px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/20 transition-all"
            >
              Espace investisseur →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
