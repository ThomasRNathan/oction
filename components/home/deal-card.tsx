"use client";

import Link from "next/link";
import type { UpcomingRow } from "@/lib/analytics/upcoming-browse";
import { decoteVsDvf, fmtDateIso, fmtEuros, fmtMap, fmtSurface } from "@/lib/format";
import { TYPE_LABELS_FR } from "@/lib/labels";
import { DaysBadge } from "@/components/days-badge";
import { WatchStar } from "@/components/watch-star";

interface Props {
  row: UpcomingRow;
  /** When provided (home page), Analyser runs inline instead of navigating. */
  onAnalyze?: (url: string) => void;
}

/**
 * Dense opportunity card for the home-page radar. The mise à prix is the hero
 * number; the décote pill answers "is it cheap?" at a glance.
 */
export function DealCard({ row, onAnalyze }: Props) {
  const decote = decoteVsDvf(row.mapDvfRatio);

  const analyzeHref = row.url ? `/?url=${encodeURIComponent(row.url)}` : null;

  return (
    <article className="animate-fade-up group rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex flex-col gap-3 hover:border-orange-500/50 hover:bg-slate-900/70 transition-all">
      {/* Type · ville · star */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {TYPE_LABELS_FR[row.propertyType] ?? row.propertyType}
            {row.surface != null && (
              <span className="text-slate-600"> · {fmtSurface(row.surface)}</span>
            )}
          </p>
          <p className="text-sm font-semibold text-white truncate mt-0.5">
            {row.city ?? "—"}
            {row.department && (
              <span className="text-slate-500 font-normal text-xs ml-1">
                ({row.department})
              </span>
            )}
          </p>
        </div>
        <WatchStar
          item={{
            id: row.id,
            url: row.url,
            city: row.city,
            department: row.department,
            propertyType: row.propertyType,
            surface: row.surface,
            miseAPrix: row.miseAPrix,
            auctionDate: row.auctionDate,
            dvfExpectedPrice: row.dvfExpectedPrice,
            mapDvfRatio: row.mapDvfRatio,
          }}
        />
      </div>

      {/* Date + countdown */}
      <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums">
        {fmtDateIso(row.auctionDate)}
        <DaysBadge days={row.daysUntil} />
        {row.tribunal && (
          <span className="text-slate-600 truncate text-[10px]">
            {row.tribunal.replace("Tribunal Judiciaire de ", "TJ ")}
          </span>
        )}
      </div>

      {/* Prices */}
      <div className="flex items-end justify-between gap-2 mt-auto">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
            Mise à prix
          </p>
          <p className="text-xl font-black text-white tabular-nums leading-tight">
            {fmtMap(row.miseAPrix)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 tabular-nums">
            DVF {fmtEuros(row.dvfExpectedPrice)}
          </p>
          <p className={`text-sm font-bold tabular-nums ${decote.color}`}>
            {decote.text}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {analyzeHref &&
          (onAnalyze ? (
            <button
              type="button"
              onClick={() => onAnalyze(row.url!)}
              className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white opacity-90 group-hover:opacity-100 hover:from-orange-600 hover:to-red-600 transition-all"
            >
              Analyser →
            </button>
          ) : (
            <Link
              href={analyzeHref}
              className="flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white opacity-90 group-hover:opacity-100 hover:from-orange-600 hover:to-red-600 transition-all"
            >
              Analyser →
            </Link>
          ))}
        {row.url && (
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Voir l'annonce sur licitor.com"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
          >
            ↗
          </a>
        )}
      </div>
    </article>
  );
}
