import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllVilles,
  getVilleBySlug,
  villeSlugs,
  type Ville,
} from "@/lib/tribunaux";
import { fmtEuros } from "@/lib/format";

// Only the known villes are valid routes (clean 404 for anything else).
export const dynamicParams = false;

export function generateStaticParams() {
  return villeSlugs().map((ville) => ({ ville }));
}

const TYPE_LABELS: Record<string, string> = {
  appartement: "Appartements",
  studio: "Studios",
  maison: "Maisons",
  immeuble: "Immeubles",
  parking: "Parkings",
  terrain: "Terrains",
  local: "Locaux",
  autre: "Autres biens",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ville: string }>;
}): Promise<Metadata> {
  const { ville } = await params;
  const v = getVilleBySlug(ville);
  if (!v) return { title: "Ville introuvable" };
  return {
    title: `Enchères immobilières judiciaires à ${v.ville}`,
    description: `Ventes aux enchères sur saisie immobilière à ${v.ville} (${v.tribunal}). ${v.stats.total.toLocaleString("fr-FR")} ventes suivies, décote vs marché DVF, types de biens. Sourcing algorithmique par OCTION.`,
    alternates: { canonical: `/encheres/${v.slug}` },
  };
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "−" : ""}${Math.abs(Math.round(n * 100))} %`;
}

export default async function VillePage({
  params,
}: {
  params: Promise<{ ville: string }>;
}) {
  const { ville } = await params;
  const v = getVilleBySlug(ville);
  if (!v) notFound();

  const related = getAllVilles()
    .filter((x) => x.slug !== v.slug)
    .slice(0, 8);

  const stats: { label: string; value: string }[] = [
    { label: "Ventes suivies", value: v.stats.total.toLocaleString("fr-FR") },
    { label: "Adjugées", value: v.stats.sold.toLocaleString("fr-FR") },
    { label: "À venir", value: v.stats.upcoming.toLocaleString("fr-FR") },
    { label: "Mise à prix médiane", value: fmtEuros(v.stats.medianMiseAPrix) },
    { label: "Adjudication médiane", value: fmtEuros(v.stats.medianAdjudication) },
    { label: "Décote médiane vs DVF", value: pct(v.stats.medianDecoteVsDvf) },
  ];

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 py-16">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500 mb-6">
        <Link href="/" className="hover:text-slate-300">
          Accueil
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/#villes" className="hover:text-slate-300">
          Enchères par ville
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-400">{v.ville}</span>
      </nav>

      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-2">
          Enchères judiciaires {v.department ? `· ${v.department}` : ""}
        </p>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.03] text-balance">
          Enchères immobilières judiciaires à {v.ville}
        </h1>
        <p className="text-slate-400 mt-4 max-w-2xl leading-relaxed">
          À {v.ville}, les ventes sur saisie immobilière relèvent du{" "}
          <span className="text-slate-300">{v.tribunal}</span>. OCTION indexe et
          analyse en continu ces adjudications pour faire ressortir, lot par lot,
          la décote à l&apos;entrée par rapport au prix de marché.
        </p>
      </header>

      {/* Stats grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-12">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-800 bg-slate-900/30 ring-gradient px-4 py-5"
          >
            <p className="text-2xl md:text-3xl font-black text-white tabular-nums leading-tight">
              {s.value}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Property types */}
      {v.topPropertyTypes.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-4">
            Types de biens à {v.ville}
          </h2>
          <div className="flex flex-wrap gap-2">
            {v.topPropertyTypes.map((t) => (
              <span
                key={t.type}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-1.5 text-sm text-slate-300"
              >
                {TYPE_LABELS[t.type] ?? t.type}
                <span className="text-slate-500 tabular-nums text-xs">
                  {t.count.toLocaleString("fr-FR")}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Method blurb */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/30 ring-gradient p-6 md:p-8 mb-12">
        <h2 className="text-xl font-bold text-white mb-3">
          Comment OCTION source les enchères à {v.ville}
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Chaque vente du ressort de {v.ville} est captée, normalisée et croisée
          avec les valeurs foncières DVF (CEREMA) pour estimer le prix de marché
          au m². Un scoring algorithmique met en avant les lots à plus forte
          décote et la meilleure liquidité ; une revue humaine valide ensuite le
          cahier des conditions de vente et les contraintes propres à chaque lot.
        </p>
        <Link
          href="/#methode"
          className="inline-block mt-4 text-sm text-orange-400 hover:underline underline-offset-4"
        >
          Voir la méthode complète →
        </Link>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.12] via-orange-500/[0.04] to-transparent p-6 md:p-10 mb-12">
        <h2 className="text-2xl font-bold text-white mb-1.5">
          Suivre les opportunités à {v.ville}
        </h2>
        <p className="text-sm text-slate-400 mb-5 max-w-xl">
          Réservé aux investisseurs avertis. Présentez votre profil pour être
          informé des dossiers correspondants. Ni offre au public, ni conseil en
          investissement.
        </p>
        <Link
          href="/investisseur"
          className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all text-sm"
        >
          Espace investisseur →
        </Link>
      </section>

      {/* Related villes (internal links) */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">
          Autres ressorts suivis
        </h2>
        <div className="flex flex-wrap gap-2">
          {related.map((r: Ville) => (
            <Link
              key={r.slug}
              href={`/encheres/${r.slug}`}
              className="text-xs text-slate-400 border border-slate-800 rounded-lg px-3 py-1.5 hover:text-white hover:border-slate-600 transition-all"
            >
              Enchères {r.ville}
            </Link>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-slate-600 mt-10">
        Données licitor.com normalisées et valeurs foncières DVF (CEREMA),
        indicatives et non contractuelles. Les performances passées ne préjugent
        pas des performances futures.
      </p>
    </main>
  );
}
