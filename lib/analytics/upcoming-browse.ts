/**
 * In-memory filter / sort / paginate over LIVE upcoming auctions.
 *
 * Unlike past-browse.ts which reads a pre-baked JSON sidecar (22k frozen rows),
 * this module hits Supabase directly for the ~600 rows with status='upcoming'
 * and caches them in module memory for 5 minutes. The cron job writes new rows
 * once a day at 06:00, so cache freshness of 5 min is plenty.
 *
 * Why not bake a sidecar like past-browse?
 *   - Upcoming changes daily (Phase D sweep flips stale rows, Phase A indexes
 *     new listings). Re-baking on every cron run would be more steps in the
 *     pipeline than just refreshing the cache in this module.
 *   - The pool is tiny (~600 vs 22k). A single Supabase round-trip is <300ms.
 *
 * Filters mirror past-browse but add `mapMin / mapMax` and `dvfMin / dvfMax`
 * numeric ranges so the investor can scope by budget.
 */
import { supabase } from "@/lib/supabase";
import {
  normalizePropertyType,
  type PropertyTypeBucket,
} from "@/lib/analytics/normalize-property-type";
import {
  normalizeOccupancy,
  type OccupancyBucket,
} from "@/lib/analytics/normalize-occupancy";
import { normalizeTribunal } from "@/lib/analytics/normalize-tribunal";

// ── Types ──────────────────────────────────────────────────────────────────

export type UpcomingSort = "date" | "decote" | "map_asc" | "map_desc";

export type UpcomingRow = {
  id: number;
  url: string | null;
  city: string | null;
  department: string | null;
  propertyType: PropertyTypeBucket;
  rawPropertyType: string | null;
  tribunal: string | null;
  occupancy: OccupancyBucket;
  surface: number | null;
  floor: string | null;
  miseAPrix: number;
  /** Postgres TIMESTAMPTZ as ISO. */
  auctionDate: string | null;
  visitDate: string | null;
  /** Days from now until auction_date. Negative = past (filtered out upstream). */
  daysUntil: number | null;
  /** DVF median €/m² for the (city, type) pair. */
  dvfMedianPerSqm: number | null;
  /** DVF-expected price = surface × dvfMedianPerSqm. Available when both fields are set. */
  dvfExpectedPrice: number | null;
  /** miseAPrix / dvfExpectedPrice. <1 = MAP below market. */
  mapDvfRatio: number | null;
};

export interface UpcomingFilters {
  tribunals?: string[];
  propertyTypes?: PropertyTypeBucket[];
  occupancies?: OccupancyBucket[];
  city?: string;
  mapMin?: number | null;
  mapMax?: number | null;
  dvfMin?: number | null;
  dvfMax?: number | null;
  /** Restrict to auctions within the next N days (null = no horizon). */
  withinDays?: number | null;
}

export interface UpcomingPage {
  rows: UpcomingRow[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  sort: UpcomingSort;
  generatedAt: string;
  poolTotal: number;
}

export interface UpcomingMeta {
  tribunals: string[];
  propertyTypes: readonly PropertyTypeBucket[];
  occupancies: readonly OccupancyBucket[];
  poolTotal: number;
  mapMin: number | null;
  mapMax: number | null;
  dvfMin: number | null;
  dvfMax: number | null;
  generatedAt: string;
}

const PAGE_SIZE = 50;

const PROPERTY_TYPES: readonly PropertyTypeBucket[] = [
  "appartement",
  "studio",
  "maison",
  "immeuble",
  "parking",
  "terrain",
  "local",
  "autre",
];

const OCCUPANCIES: readonly Exclude<OccupancyBucket, null>[] = [
  "libre",
  "occupé",
  "loué",
];

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

let _cache: {
  rows: UpcomingRow[];
  generatedAt: string;
  expiresAt: number;
} | null = null;

let _inflight: Promise<UpcomingRow[]> | null = null;

interface DbUpcomingRow {
  licitor_id: number;
  url: string | null;
  city: string | null;
  department: string | null;
  property_type: string | null;
  tribunal: string | null;
  occupancy: string | null;
  surface: number | string | null;
  floor: string | null;
  mise_a_prix: number | string;
  auction_date: string | null;
  visit_date: string | null;
  dvf_median_per_sqm: number | string | null;
  dvf_expected_price: number | string | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function daysBetween(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.round((t - now) / (1000 * 60 * 60 * 24));
}

/**
 * Licitor groups several lots under one sale reference (one `licitor_id`):
 *   - distinct lots at distinct addresses share an id but have distinct URLs
 *     (e.g. 108650 = parkings Paris 12 + appartement + local Champigny);
 *   - the index/detail scraper can also leave a placeholder row (mise_a_prix 0,
 *     surface null) next to the detailed row for the SAME URL.
 *
 * Dedupe by URL, keeping the most complete row per URL (priced + measured
 * wins), so the table renders one row per real lot and React keys stay unique.
 * URL-less rows are passed through untouched (nothing to dedupe on).
 */
function dedupeByUrl(rows: UpcomingRow[]): UpcomingRow[] {
  const completeness = (r: UpcomingRow) =>
    (r.miseAPrix > 0 ? 2 : 0) + (r.surface != null ? 1 : 0);

  const best = new Map<string, UpcomingRow>();
  const passthrough: UpcomingRow[] = [];

  for (const r of rows) {
    if (!r.url) {
      passthrough.push(r);
      continue;
    }
    const prev = best.get(r.url);
    if (!prev || completeness(r) > completeness(prev)) best.set(r.url, r);
  }

  return [...best.values(), ...passthrough];
}

function mapDbRow(r: DbUpcomingRow, now: number): UpcomingRow {
  const surface = num(r.surface);
  const map = num(r.mise_a_prix);
  const dvfPerSqm = num(r.dvf_median_per_sqm);
  // Prefer the stored generated column when present; fall back to live compute
  // so rows enriched before the GENERATED column existed still get a value.
  const expected =
    num(r.dvf_expected_price) ??
    (surface != null && dvfPerSqm != null ? surface * dvfPerSqm : null);
  const mapDvfRatio = expected != null && map != null && expected > 0 ? map / expected : null;

  return {
    id: r.licitor_id,
    url: r.url,
    city: r.city,
    department: r.department,
    propertyType: normalizePropertyType(r.property_type),
    rawPropertyType: r.property_type,
    tribunal: normalizeTribunal(r.tribunal),
    occupancy: normalizeOccupancy(r.occupancy),
    surface,
    floor: r.floor,
    miseAPrix: map ?? 0,
    auctionDate: r.auction_date,
    visitDate: r.visit_date,
    daysUntil: daysBetween(r.auction_date, now),
    dvfMedianPerSqm: dvfPerSqm,
    dvfExpectedPrice: expected,
    mapDvfRatio,
  };
}

async function fetchPool(): Promise<UpcomingRow[]> {
  // Coalesce concurrent refreshes so the first miss only triggers one round-trip.
  if (_inflight) return _inflight;

  _inflight = (async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("past_auctions")
      .select(
        "licitor_id,url,city,department,property_type,tribunal,occupancy,surface,floor,mise_a_prix,auction_date,visit_date,dvf_median_per_sqm,dvf_expected_price"
      )
      .eq("status", "upcoming")
      .gte("auction_date", nowIso)
      .order("auction_date", { ascending: true })
      .limit(2000); // safety cap — pool is ~600 in practice

    if (error) {
      _inflight = null;
      throw new Error(`upcoming pool fetch failed: ${error.message}`);
    }

    const nowMs = Date.now();
    const mapped = (data ?? []).map((r) => mapDbRow(r as DbUpcomingRow, nowMs));
    const rows = dedupeByUrl(mapped);

    _cache = {
      rows,
      generatedAt: new Date().toISOString(),
      expiresAt: nowMs + CACHE_TTL_MS,
    };
    _inflight = null;
    return rows;
  })();

  return _inflight;
}

async function getPool(): Promise<{ rows: UpcomingRow[]; generatedAt: string }> {
  if (_cache && _cache.expiresAt > Date.now()) {
    return { rows: _cache.rows, generatedAt: _cache.generatedAt };
  }
  const rows = await fetchPool();
  // Cache always populated by fetchPool; non-null asserted but fall back defensively.
  return {
    rows,
    generatedAt: _cache?.generatedAt ?? new Date().toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Force the next call to refetch from Supabase. Used by the warm-DVF route. */
export function invalidateUpcomingCache(): void {
  _cache = null;
}

export async function getUpcomingMeta(): Promise<UpcomingMeta> {
  const { rows, generatedAt } = await getPool();

  const tribunals = Array.from(
    new Set(rows.map((r) => r.tribunal).filter((x): x is string => !!x))
  ).sort((a, b) => a.localeCompare(b, "fr"));

  const maps = rows.map((r) => r.miseAPrix).filter((n) => n > 0);
  const dvfs = rows
    .map((r) => r.dvfExpectedPrice)
    .filter((n): n is number => n != null && n > 0);

  return {
    tribunals,
    propertyTypes: PROPERTY_TYPES,
    occupancies: OCCUPANCIES,
    poolTotal: rows.length,
    mapMin: maps.length ? Math.min(...maps) : null,
    mapMax: maps.length ? Math.max(...maps) : null,
    dvfMin: dvfs.length ? Math.min(...dvfs) : null,
    dvfMax: dvfs.length ? Math.max(...dvfs) : null,
    generatedAt,
  };
}

export interface UpcomingHighlights {
  stats: {
    poolTotal: number;
    withDvf: number;
    next7Days: number;
    /** Median (1 − MAP/DVF) over plausible rows. 0.42 = MAP is typically 42 % below DVF. */
    medianDecote: number | null;
  };
  bestDecote: UpcomingRow[];
  thisWeek: UpcomingRow[];
  smallBudget: UpcomingRow[];
  generatedAt: string;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Curated picks for the home-page deal radar.
 *
 * "Plausible" guards keep data glitches off the landing page: a ratio of
 * 0.002 is almost always a bad surface or a DVF (city,type) mismatch, not a
 * 99.8 % discount — so bestDecote requires ratio ≥ 0.05, surface ≥ 8 m² and
 * an expected price ≥ 20 k€.
 */
export async function getUpcomingHighlights(): Promise<UpcomingHighlights> {
  const { rows, generatedAt } = await getPool();

  const future = rows.filter((r) => r.daysUntil == null || r.daysUntil >= 0);
  const withDvf = future.filter(
    (r) => r.mapDvfRatio != null && r.mapDvfRatio > 0
  );
  const plausible = withDvf.filter(
    (r) =>
      r.mapDvfRatio! >= 0.05 &&
      r.mapDvfRatio! <= 1.2 &&
      (r.surface ?? 0) >= 8 &&
      (r.dvfExpectedPrice ?? 0) >= 20_000
  );

  const byDecote = (a: UpcomingRow, b: UpcomingRow) =>
    (a.mapDvfRatio ?? Number.POSITIVE_INFINITY) -
    (b.mapDvfRatio ?? Number.POSITIVE_INFINITY);

  const bestDecote = [...plausible].sort(byDecote).slice(0, 8);

  const thisWeek = future
    .filter((r) => r.daysUntil != null && r.daysUntil <= 7)
    .sort((a, b) => a.daysUntil! - b.daysUntil! || byDecote(a, b))
    .slice(0, 8);

  const smallBudget = future
    .filter((r) => r.miseAPrix > 0 && r.miseAPrix <= 100_000)
    .sort((a, b) => byDecote(a, b) || a.miseAPrix - b.miseAPrix)
    .slice(0, 8);

  return {
    stats: {
      poolTotal: future.length,
      withDvf: withDvf.length,
      next7Days: future.filter((r) => r.daysUntil != null && r.daysUntil <= 7)
        .length,
      medianDecote: median(plausible.map((r) => 1 - r.mapDvfRatio!)),
    },
    bestDecote,
    thisWeek,
    smallBudget,
    generatedAt,
  };
}

export async function queryUpcoming(
  filters: UpcomingFilters,
  sort: UpcomingSort,
  page: number
): Promise<UpcomingPage> {
  const { rows, generatedAt } = await getPool();

  const cityNeedle = filters.city?.trim().toLowerCase();
  const tribunals = filters.tribunals?.length ? filters.tribunals : null;
  const types = filters.propertyTypes?.length ? filters.propertyTypes : null;
  const occs = filters.occupancies?.length ? filters.occupancies : null;
  const mapMin = filters.mapMin ?? null;
  const mapMax = filters.mapMax ?? null;
  const dvfMin = filters.dvfMin ?? null;
  const dvfMax = filters.dvfMax ?? null;
  const horizon = filters.withinDays ?? null;

  const filtered = rows.filter((r) => {
    if (tribunals && (r.tribunal === null || !tribunals.includes(r.tribunal))) return false;
    if (types && !types.includes(r.propertyType)) return false;
    if (occs && !occs.includes(r.occupancy)) return false;
    if (cityNeedle && !(r.city ?? "").toLowerCase().includes(cityNeedle)) return false;
    if (mapMin != null && r.miseAPrix < mapMin) return false;
    if (mapMax != null && r.miseAPrix > mapMax) return false;
    if (dvfMin != null && (r.dvfExpectedPrice == null || r.dvfExpectedPrice < dvfMin)) return false;
    if (dvfMax != null && (r.dvfExpectedPrice == null || r.dvfExpectedPrice > dvfMax)) return false;
    if (horizon != null && (r.daysUntil == null || r.daysUntil > horizon)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (sort) {
      case "decote": {
        // Best (smallest) MAP/DVF ratio first. Rows without DVF go last.
        const ra = a.mapDvfRatio ?? Number.POSITIVE_INFINITY;
        const rb = b.mapDvfRatio ?? Number.POSITIVE_INFINITY;
        if (ra !== rb) return ra - rb;
        // Tiebreak: soonest first
        const da = a.auctionDate ? Date.parse(a.auctionDate) : Number.POSITIVE_INFINITY;
        const db = b.auctionDate ? Date.parse(b.auctionDate) : Number.POSITIVE_INFINITY;
        return da - db;
      }
      case "map_asc":
        return a.miseAPrix - b.miseAPrix;
      case "map_desc":
        return b.miseAPrix - a.miseAPrix;
      case "date":
      default: {
        const da = a.auctionDate ? Date.parse(a.auctionDate) : Number.POSITIVE_INFINITY;
        const db = b.auctionDate ? Date.parse(b.auctionDate) : Number.POSITIVE_INFINITY;
        return da - db;
      }
    }
  });

  const safePage = Math.max(1, Math.floor(page) || 1);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  return {
    rows: slice,
    total: filtered.length,
    page: safePage,
    pageSize: PAGE_SIZE,
    hasNext: filtered.length > start + PAGE_SIZE,
    sort,
    generatedAt,
    poolTotal: rows.length,
  };
}
