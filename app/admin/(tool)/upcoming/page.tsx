"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/upcoming/filter-bar";
import { ResultsTable } from "@/components/upcoming/results-table";
import type {
  UpcomingFilters,
  UpcomingMeta,
  UpcomingPage as UpcomingPageData,
  UpcomingSort,
} from "@/lib/analytics/upcoming-browse";

type ApiResponse = UpcomingPageData & { meta?: UpcomingMeta };

function buildQuery(
  sort: UpcomingSort,
  filters: UpcomingFilters,
  page: number
): string {
  const sp = new URLSearchParams();
  if (sort !== "date") sp.set("sort", sort);
  filters.tribunals?.forEach((t) => sp.append("tribunal", t));
  filters.propertyTypes?.forEach((t) => sp.append("propertyType", t));
  filters.occupancies?.forEach((o) => {
    if (o !== null) sp.append("occupancy", o);
  });
  if (filters.city) sp.set("city", filters.city);
  if (filters.mapMin != null) sp.set("mapMin", String(filters.mapMin));
  if (filters.mapMax != null) sp.set("mapMax", String(filters.mapMax));
  if (filters.dvfMin != null) sp.set("dvfMin", String(filters.dvfMin));
  if (filters.dvfMax != null) sp.set("dvfMax", String(filters.dvfMax));
  if (filters.withinDays != null)
    sp.set("withinDays", String(filters.withinDays));
  if (page > 1) sp.set("page", String(page));
  return sp.toString();
}

const SORT_OPTIONS: { id: UpcomingSort; label: string }[] = [
  { id: "date", label: "Date ↑" },
  { id: "decote", label: "Décote MAP/DVF" },
  { id: "map_asc", label: "MAP ↑" },
  { id: "map_desc", label: "MAP ↓" },
];

function UpcomingContent() {
  /**
   * Inbound deep links seed the initial state: /upcoming?withinDays=7 (home
   * radar tile), ?city=, ?sort=decote. Read once in the useState initializers;
   * after mount the filter bar owns the state. Param names mirror buildQuery().
   */
  const searchParams = useSearchParams();

  const [sort, setSort] = useState<UpcomingSort>(() => {
    const s = searchParams.get("sort");
    return s === "decote" || s === "map_asc" || s === "map_desc" ? s : "date";
  });
  const [filters, setFilters] = useState<UpcomingFilters>(() => {
    const f: UpcomingFilters = {};
    const within = Number(searchParams.get("withinDays"));
    if (Number.isFinite(within) && within > 0) f.withinDays = within;
    const city = searchParams.get("city");
    if (city?.trim()) f.city = city.trim();
    return f;
  });
  const [page, setPage] = useState(1);

  /**
   * Derived-key fetch: loading/error fall out of comparing the stored
   * response's key with the current query string, so no setState runs in the
   * effect body and a filter change triggers exactly one request (the old
   * two-effect version fired a stale-page fetch before the page reset).
   */
  const queryString = buildQuery(sort, filters, page);

  const [snap, setSnap] = useState<{
    key: string;
    data: UpcomingPageData;
    meta: UpcomingMeta | null;
  } | null>(null);
  const [err, setErr] = useState<{ key: string; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/upcoming?${queryString}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        if (cancelled) return;
        setSnap((prev) => ({
          key: queryString,
          data: json,
          // meta only ships on page 1 — carry it across page turns.
          meta: json.meta ?? prev?.meta ?? null,
        }));
      })
      .catch((e) => {
        if (cancelled) return;
        setErr({
          key: queryString,
          msg: e instanceof Error ? e.message : "Erreur de chargement",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const data = snap?.data ?? null;
  const meta = snap?.meta ?? null;
  const error = err?.key === queryString ? err.msg : null;
  const loading = !error && snap?.key !== queryString;

  /** Sort/filter changes restart pagination — done in the event, not an effect. */
  const applySort = (s: UpcomingSort) => {
    setSort(s);
    setPage(1);
  };
  const applyFilters = (f: UpcomingFilters) => {
    setFilters(f);
    setPage(1);
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <main className="min-h-screen bg-[#0a0f1a] overflow-x-hidden">
      {/* Ambient blobs (match the home page) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-orange-500/8 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/6 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-5">
        {/* Title + sort pills */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Ventes à venir</h1>
            <p className="text-sm text-slate-500 mt-1">
              Les enchères programmées dans le pool actif. Filtrez par
              budget, tribunal ou décote vs DVF.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => applySort(opt.id)}
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
                {meta.poolTotal.toLocaleString("fr-FR")} ventes à venir
                {" · "}
                Mis à jour{" "}
                {new Date(meta.generatedAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Filters */}
        {meta && (
          <FilterBar
            filters={filters}
            setFilters={applyFilters}
            tribunals={meta.tribunals}
            propertyTypes={meta.propertyTypes}
            occupancies={meta.occupancies}
            hintMapMin={meta.mapMin}
            hintMapMax={meta.mapMax}
            hintDvfMin={meta.dvfMin}
            hintDvfMax={meta.dvfMax}
          />
        )}

        {/* Results */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        ) : (
          <ResultsTable rows={data?.rows ?? []} loading={loading} />
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
          Données licitor.com normalisées · DVF CEREMA pour le prix marché ·
          indicatif, non garanti.
        </p>
      </div>
    </main>
  );
}

/** useSearchParams (deep-link filters) requires a Suspense boundary on a prerendered route. */
export default function UpcomingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0a0f1a]" />}>
      <UpcomingContent />
    </Suspense>
  );
}
