"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UpcomingHighlights } from "@/lib/analytics/upcoming-browse";
import { DealCard } from "@/components/home/deal-card";

type RadarTab = "bestDecote" | "thisWeek" | "smallBudget";

interface Props {
  onAnalyze: (url: string) => void;
}

const TABS: { id: RadarTab; label: string }[] = [
  { id: "bestDecote", label: "Meilleures décotes" },
  { id: "thisWeek", label: "Cette semaine" },
  { id: "smallBudget", label: "Petits budgets" },
];

/**
 * "Radar des opportunités" — the live heart of the home page. Pulls curated
 * picks from /api/highlights (same 5-min pool cache as /upcoming) and lets
 * the investor jump straight into a full analysis.
 */
export function Radar({ onAnalyze }: Props) {
  const [data, setData] = useState<UpcomingHighlights | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<RadarTab>("bestDecote");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/highlights")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<UpcomingHighlights>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Quiet failure: the radar is a bonus block, never an error wall.
  if (failed) return null;

  const stats = data?.stats;
  const rows = data?.[tab] ?? [];

  const statTiles = [
    {
      value: stats ? stats.poolTotal.toLocaleString("fr-FR") : null,
      label: "ventes à venir",
      href: "/upcoming",
    },
    {
      value: stats ? String(stats.next7Days) : null,
      label: "sous 7 jours",
      href: "/upcoming?withinDays=7",
    },
    {
      // "—" (not shimmer) once stats are loaded but no row has DVF data yet.
      value: stats
        ? stats.medianDecote != null
          ? `−${Math.round(stats.medianDecote * 100)} %`
          : "—"
        : null,
      label: "décote médiane vs DVF",
      href: null,
      accent: true,
    },
    {
      value: stats ? stats.withDvf.toLocaleString("fr-FR") : null,
      label: "avec estimation DVF",
      href: null,
    },
  ];

  return (
    <section className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Radar des opportunités
        </h2>
        <Link
          href="/upcoming"
          className="text-xs text-orange-400 hover:underline underline-offset-4"
        >
          Voir les {stats ? stats.poolTotal.toLocaleString("fr-FR") : ""} ventes
          à venir →
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 stagger">
        {statTiles.map((t) => {
          const inner = (
            <div className="animate-fade-up rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-3 h-full transition-colors hover:border-slate-600">
              {t.value == null ? (
                <div className="shimmer h-7 w-16 rounded mb-1" />
              ) : (
                <p
                  className={
                    "text-2xl font-black tabular-nums leading-tight " +
                    (t.accent
                      ? "bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent"
                      : "text-white")
                  }
                >
                  {t.value}
                </p>
              )}
              <p className="text-[11px] text-slate-500">{t.label}</p>
            </div>
          );
          return t.href ? (
            <Link key={t.label} href={t.href}>
              {inner}
            </Link>
          ) : (
            <div key={t.label}>{inner}</div>
          );
        })}
      </div>

      {/* List switcher */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = data?.[t.id]?.length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={active}
              className={
                active
                  ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm transition-all"
                  : "px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
              }
            >
              {t.label}
              {count != null && count > 0 && (
                <span className={active ? "ml-1.5 opacity-80" : "ml-1.5 text-slate-600"}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <span className="ml-auto self-center text-[10px] text-slate-600">
          MAP vs prix DVF du secteur · indicatif
        </span>
      </div>

      {/* Cards */}
      {data == null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="shimmer h-44 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 border border-slate-800 rounded-xl p-6 text-center">
          Rien dans cette catégorie pour le moment — revenez après le passage
          du scraper (6 h 00).
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          {rows.map((r, i) => (
            <DealCard key={`${r.id}::${r.url ?? i}`} row={r} onAnalyze={onAnalyze} />
          ))}
        </div>
      )}
    </section>
  );
}
