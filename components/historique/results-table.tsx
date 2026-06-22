"use client";

import Link from "next/link";
import type { BrowseMode, BrowseRow } from "@/lib/analytics/past-browse";
import { fmtDateIso, fmtEuros, fmtSurface } from "@/lib/format";
import { TYPE_LABELS_FR } from "@/lib/labels";

interface Props {
  rows: BrowseRow[];
  mode: BrowseMode;
  loading: boolean;
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
  const emptyMessage = (
    <>
      Aucun résultat — élargissez les filtres.
      {mode === "market" && (
        <span className="block text-xs text-slate-600 mt-1">
          Le mode « Décote vs marché » nécessite une donnée DVF locale,
          qui n&apos;existe que pour ~12 % des ventes.
        </span>
      )}
    </>
  );

  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden md:block bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden">
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
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500 text-sm"
                  >
                    {emptyMessage}
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
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums whitespace-nowrap">
                      {fmtEuros(r.miseAPrix)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 tabular-nums font-medium whitespace-nowrap">
                      {fmtEuros(r.adjudication)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap ${score.color}`}
                    >
                      {score.text}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.tribunal ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs tabular-nums whitespace-nowrap">
                      {fmtDateIso(r.auctionDate)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.url ? (
                        <span className="inline-flex items-center gap-2">
                          <Link
                            href={`/?url=${encodeURIComponent(r.url)}`}
                            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                            title="Lancer l'analyse complète"
                          >
                            Analyser
                          </Link>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-white transition-colors"
                            title="Voir l'annonce sur licitor.com"
                          >
                            ↗
                          </a>
                        </span>
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

      {/* Mobile: stacked cards */}
      <ul className="md:hidden space-y-2.5">
        {rows.length === 0 && !loading && (
          <li className="px-4 py-8 text-center text-slate-500 text-sm bg-slate-800/50 border border-slate-700 rounded-2xl">
            {emptyMessage}
          </li>
        )}
        {rows.map((r) => {
          const score =
            mode === "market"
              ? fmtMarketRatio(r.marketRatio)
              : fmtUncontestedRatio(r.uncontestedRatio);
          return (
            <li
              key={`${r.id}-${r.auctionDate ?? ""}`}
              className="rounded-xl border border-slate-700 bg-slate-900/40 p-3.5"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {r.city ?? "—"}
                    {r.department && (
                      <span className="text-slate-500 font-normal text-xs ml-1">
                        ({r.department})
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                    {TYPE_LABELS_FR[r.propertyType] ?? r.propertyType} ·{" "}
                    {fmtSurface(r.surface)} · {fmtDateIso(r.auctionDate)}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold tabular-nums ${score.color}`}>
                  {score.text}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2 mt-2">
                <div>
                  <p className="text-[10px] text-slate-500">Adjugé</p>
                  <p className="text-base font-semibold text-white tabular-nums">
                    {fmtEuros(r.adjudication)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">MAP</p>
                  <p className="text-sm text-slate-400 tabular-nums">
                    {fmtEuros(r.miseAPrix)}
                  </p>
                </div>
              </div>

              {r.url && (
                <div className="flex gap-2 mt-2.5">
                  <Link
                    href={`/?url=${encodeURIComponent(r.url)}`}
                    className="flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 text-slate-300 transition-all"
                  >
                    Analyser →
                  </Link>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 transition-all"
                  >
                    ↗
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
