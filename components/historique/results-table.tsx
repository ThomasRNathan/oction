"use client";

import type { BrowseMode, BrowseRow } from "@/lib/analytics/past-browse";

interface Props {
  rows: BrowseRow[];
  mode: BrowseMode;
  loading: boolean;
}

const TYPE_LABELS_FR: Record<string, string> = {
  appartement: "Appartement",
  studio: "Studio",
  maison: "Maison",
  immeuble: "Immeuble",
  parking: "Parking",
  terrain: "Terrain",
  local: "Local",
  autre: "Autre",
};

function fmtEuros(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(".", ",")} M€`;
  if (n >= 10_000) return `${Math.round(n / 1000)} k€`;
  return `${n.toLocaleString("fr-FR")} €`;
}

function fmtSurface(s: number | null): string {
  if (s == null) return "—";
  return `${Math.round(s)} m²`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  // d is YYYY-MM-DD
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtUncontestedRatio(r: number): { text: string; color: string } {
  const pct = r * 100;
  if (Math.abs(pct) < 0.05) return { text: "= MAP", color: "text-emerald-400" };
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1).replace(".", ",")}%`,
    color: pct < 1 ? "text-emerald-400" : pct < 5 ? "text-amber-400" : "text-slate-400",
  };
}

function fmtMarketRatio(r: number | null): { text: string; color: string } {
  if (r == null) return { text: "—", color: "text-slate-600" };
  // r = adj_per_sqm / dvf_per_sqm.  r=0.6 → -40 % vs DVF.
  const discount = 1 - r;
  const pct = Math.round(discount * 100);
  const text = `${discount >= 0 ? "-" : "+"}${Math.abs(pct)}% vs DVF`;
  let color = "text-slate-400";
  if (discount >= 0.4) color = "text-emerald-400";
  else if (discount >= 0.2) color = "text-amber-400";
  else if (discount < 0) color = "text-red-400";
  return { text, color };
}

export function ResultsTable({ rows, mode, loading }: Props) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/40 border-b border-slate-700">
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">Ville</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Surface</th>
              <th className="px-4 py-3 font-medium text-right">Mise à prix</th>
              <th className="px-4 py-3 font-medium text-right">Adjudication</th>
              <th className="px-4 py-3 font-medium text-right">
                {mode === "market" ? "vs DVF" : "vs MAP"}
              </th>
              <th className="px-4 py-3 font-medium">Tribunal</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">↗</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-slate-500 text-sm"
                >
                  Aucun résultat — élargissez les filtres.
                  {mode === "market" && (
                    <span className="block text-xs text-slate-600 mt-1">
                      Le mode « Décote vs marché » nécessite une donnée DVF locale,
                      qui n&apos;existe que pour ~12 % des ventes.
                    </span>
                  )}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const score =
                mode === "market"
                  ? fmtMarketRatio(r.marketRatio)
                  : fmtUncontestedRatio(r.uncontestedRatio);
              return (
                <tr
                  key={`${r.id}-${r.auctionDate ?? ""}`}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-300">
                    {r.city ?? "—"}
                    {r.department && (
                      <span className="text-slate-600 text-xs ml-1">
                        ({r.department})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {TYPE_LABELS_FR[r.propertyType] ?? r.propertyType}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                    {fmtSurface(r.surface)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                    {fmtEuros(r.miseAPrix)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200 tabular-nums font-medium">
                    {fmtEuros(r.adjudication)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${score.color}`}
                  >
                    {score.text}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {r.tribunal ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs tabular-nums whitespace-nowrap">
                    {fmtDate(r.auctionDate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-orange-400 transition-colors"
                        title="Voir l'annonce sur licitor.com"
                      >
                        ↗
                      </a>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
