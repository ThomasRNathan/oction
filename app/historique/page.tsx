"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/historique/filter-bar";
import { ResultsTable } from "@/components/historique/results-table";
import type {
  BrowseFilters,
  BrowseMode,
  BrowsePage,
} from "@/lib/analytics/past-browse";
import type { PropertyTypeBucket } from "@/lib/analytics/normalize-property-type";
import type { OccupancyBucket } from "@/lib/analytics/normalize-occupancy";

interface BrowseMeta {
  tribunals: string[];
  years: number[];
  propertyTypes: readonly PropertyTypeBucket[];
  occupancies: readonly OccupancyBucket[];
  poolSizeUncontested: number;
  poolSizeMarket: number;
  generatedAt: string;
}

type ApiResponse = BrowsePage & { meta?: BrowseMeta };

function buildQuery(
  mode: BrowseMode,
  filters: BrowseFilters,
  page: number
): string {
  const sp = new URLSearchParams();
  sp.set("mode", mode);
  if (filters.tribunal) sp.set("tribunal", filters.tribunal);
  if (filters.propertyType) sp.set("propertyType", filters.propertyType);
  if (filters.year) sp.set("year", String(filters.year));
  if (filters.occupancy) sp.set("occupancy", filters.occupancy);
  if (filters.city) sp.set("city", filters.city);
  if (page > 1) sp.set("page", String(page));
  return sp.toString();
}

export default function HistoriquePage() {
  const [mode, setMode] = useState<BrowseMode>("uncontested");
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [page, setPage] = useState(1);

  const [data, setData] = useState<BrowsePage | null>(null);
  const [meta, setMeta] = useState<BrowseMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to page 1 whenever the result-set shape changes.
  // Use a ref-style guard so we don't fight the page-only effect below.
  useEffect(() => {
    setPage(1);
  }, [mode, filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/past?${buildQuery(mode, filters, page)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        if (json.meta) setMeta(json.meta);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, filters, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <main className="min-h-screen bg-[#0a0f1a] overflow-x-hidden">
      {/* Ambient blobs (match the home page) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-orange-500/8 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/6 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-5">
        {/* Title + mode pills */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Historique des ventes</h1>
            <p className="text-sm text-slate-500 mt-1">
              Parcourez les enchères passées pour calibrer vos prochaines mises.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {(
              [
                { id: "uncontested", label: "Sans surenchère" },
                { id: "market", label: "Décote vs marché" },
              ] as { id: BrowseMode; label: string }[]
            ).map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm transition-all"
                      : "px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                  }
                >
                  {opt.label}
                </button>
              );
            })}

            {meta && (
              <span className="text-[10px] text-slate-600 ml-auto">
                {mode === "market"
                  ? `${meta.poolSizeMarket.toLocaleString("fr-FR")} ventes avec donnée DVF`
                  : `${meta.poolSizeUncontested.toLocaleString("fr-FR")} ventes au total`}
                {" · "}
                Mis à jour {new Date(meta.generatedAt).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        </div>

        {/* Filters */}
        {meta && (
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            tribunals={meta.tribunals}
            years={meta.years}
            propertyTypes={meta.propertyTypes}
            occupancies={meta.occupancies}
          />
        )}

        {/* Results */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        ) : (
          <ResultsTable
            rows={data?.rows ?? []}
            mode={mode}
            loading={loading}
          />
        )}

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between gap-4 px-1">
            <button
              type="button"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
            >
              ← Précédent
            </button>

            <div className="text-xs text-slate-500 tabular-nums">
              Page {data.page} / {totalPages} ·{" "}
              {data.total.toLocaleString("fr-FR")} résultats
            </div>

            <button
              type="button"
              disabled={!data.hasNext || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
            >
              Suivant →
            </button>
          </div>
        )}

        <p className="text-[10px] text-slate-600 text-center pt-2">
          Données issues des annonces licitor.com normalisées · DVF CEREMA pour
          le prix marché · indicatif, non garanti.
        </p>
      </div>
    </main>
  );
}
