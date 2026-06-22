"use client";

import { removeWatch, useWatchlist } from "@/lib/watchlist";
import { decoteVsDvf, fmtDateIso, fmtMap } from "@/lib/format";
import { TYPE_LABELS_FR } from "@/lib/labels";
import { DaysBadge } from "@/components/days-badge";

interface Props {
  onAnalyze: (url: string) => void;
}

function daysFromNow(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

/**
 * Horizontal strip of starred auctions, pinned under the search input on the
 * home page. Renders from localStorage snapshots so entries survive the lot
 * leaving the upcoming pool (the badge just disappears once the date passes).
 */
export function WatchlistStrip({ onAnalyze }: Props) {
  const watchlist = useWatchlist();

  if (watchlist.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto mb-10 animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-400">★</span>
        <h2 className="text-sm font-semibold text-white">
          Mes ventes suivies
          <span className="text-slate-500 font-normal ml-1.5">
            {watchlist.length}
          </span>
        </h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {watchlist.map((w) => {
          const days = daysFromNow(w.auctionDate);
          const past = days != null && days < 0;
          const decote = decoteVsDvf(w.mapDvfRatio);
          return (
            <div
              key={w.id}
              className={`flex-shrink-0 w-60 rounded-xl border bg-slate-900/40 p-3 transition-colors ${
                past
                  ? "border-slate-800 opacity-60"
                  : "border-slate-700 hover:border-amber-500/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    {TYPE_LABELS_FR[w.propertyType] ?? w.propertyType}
                  </p>
                  <p className="text-sm font-semibold text-white truncate">
                    {w.city ?? "—"}
                    {w.department && (
                      <span className="text-slate-500 font-normal text-xs ml-1">
                        ({w.department})
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeWatch(w.id)}
                  aria-label="Retirer du suivi"
                  title="Retirer du suivi"
                  className="text-amber-400 hover:text-slate-500 transition-colors text-sm leading-none"
                >
                  ★
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums mb-2">
                {fmtDateIso(w.auctionDate)}
                {past ? (
                  <span className="text-[10px] text-slate-600 border border-slate-800 rounded px-1.5 py-0.5">
                    passée
                  </span>
                ) : (
                  <DaysBadge days={days} />
                )}
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-black text-white tabular-nums">
                  {fmtMap(w.miseAPrix)}
                </span>
                <span className={`text-xs font-semibold tabular-nums ${decote.color}`}>
                  {decote.text}
                </span>
              </div>

              {w.url && (
                <button
                  type="button"
                  onClick={() => onAnalyze(w.url!)}
                  className="mt-2.5 w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-orange-500/60 transition-all"
                >
                  Analyser →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
