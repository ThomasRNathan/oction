"use client";

import Link from "next/link";
import type { UpcomingRow } from "@/lib/analytics/upcoming-browse";
import { decoteVsDvf, fmtDateIso, fmtEuros, fmtMap, fmtSurface } from "@/lib/format";
import { TYPE_LABELS_FR } from "@/lib/labels";
import { DaysBadge } from "@/components/days-badge";
import { WatchStar } from "@/components/watch-star";

interface Props {
  rows: UpcomingRow[];
  loading: boolean;
}

function watchItem(r: UpcomingRow) {
  return {
    id: r.id,
    url: r.url,
    city: r.city,
    department: r.department,
    propertyType: r.propertyType,
    surface: r.surface,
    miseAPrix: r.miseAPrix,
    auctionDate: r.auctionDate,
    dvfExpectedPrice: r.dvfExpectedPrice,
    mapDvfRatio: r.mapDvfRatio,
  };
}

export function ResultsTable({ rows, loading }: Props) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden md:block bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/40 border-b border-slate-700">
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3 font-medium w-8" aria-label="Suivi" />
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Ville</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Surface</th>
                <th className="px-4 py-3 font-medium text-right">Mise à prix</th>
                <th className="px-4 py-3 font-medium text-right">DVF estimé</th>
                <th className="px-4 py-3 font-medium text-right">Décote</th>
                <th className="px-4 py-3 font-medium">Tribunal</th>
                <th className="px-4 py-3 font-medium">Visite</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-slate-500 text-sm"
                  >
                    Aucune vente à venir avec ces filtres — élargissez.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const decote = decoteVsDvf(r.mapDvfRatio);
                return (
                  <tr
                    key={`${r.id}::${r.url ?? i}`}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-3 py-3 text-center">
                      <WatchStar item={watchItem(r)} size="text-sm" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 text-xs tabular-nums">
                          {fmtDateIso(r.auctionDate)}
                        </span>
                        <DaysBadge days={r.daysUntil} />
                      </div>
                    </td>
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
                    <td className="px-4 py-3 text-right text-slate-200 tabular-nums font-medium whitespace-nowrap">
                      {fmtMap(r.miseAPrix)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums whitespace-nowrap">
                      {fmtEuros(r.dvfExpectedPrice)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap ${decote.color}`}
                    >
                      {decote.text}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.tribunal ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs tabular-nums whitespace-nowrap">
                      {fmtDateIso(r.visitDate)}
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
            Aucune vente à venir avec ces filtres — élargissez.
          </li>
        )}
        {rows.map((r, i) => {
          const decote = decoteVsDvf(r.mapDvfRatio);
          return (
            <li
              key={`${r.id}::${r.url ?? i}`}
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
                <div className="flex items-center gap-2 shrink-0">
                  <DaysBadge days={r.daysUntil} />
                  <WatchStar item={watchItem(r)} size="text-lg" />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 mt-2">
                <div>
                  <p className="text-[10px] text-slate-500">Mise à prix</p>
                  <p className="text-base font-semibold text-white tabular-nums">
                    {fmtMap(r.miseAPrix)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    DVF {fmtEuros(r.dvfExpectedPrice)}
                  </p>
                  <p className={`text-sm font-semibold tabular-nums ${decote.color}`}>
                    {decote.text}
                  </p>
                </div>
              </div>

              {r.url && (
                <div className="flex gap-2 mt-2.5">
                  <Link
                    href={`/?url=${encodeURIComponent(r.url)}`}
                    className="flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white transition-all"
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
