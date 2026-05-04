/**
 * In-memory filter / sort / paginate over the pre-baked past-auctions sidecar.
 *
 * The sidecar (lib/data/past-auctions-browse.json, ~7.5 MB raw) is loaded once
 * at module-init time. The /api/past route handler calls queryBrowse() per
 * request — pure JS, sub-50 ms responses, no DB call.
 *
 * Re-bake with: pnpm tsx scripts/analytics/bake-past-auctions-browse.ts
 */
import sidecar from "@/lib/data/past-auctions-browse.json";
import type { PropertyTypeBucket } from "@/lib/analytics/normalize-property-type";
import type { OccupancyBucket } from "@/lib/analytics/normalize-occupancy";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
export type BrowseMode = "uncontested" | "market";

export type BrowseRow = {
  id: number;
  url: string | null;
  city: string | null;
  department: string | null;
  propertyType: PropertyTypeBucket;
  tribunal: string | null;
  occupancy: OccupancyBucket;
  surface: number | null;
  miseAPrix: number;
  adjudication: number;
  auctionDate: string | null;
  year: number | null;
  uncontestedRatio: number;
  marketRatio: number | null;
};

export interface BrowseFilters {
  /** Match if the row's tribunal is in this list. Empty/undefined = no filter. */
  tribunals?: string[];
  /** Match if the row's normalized property-type bucket is in this list. */
  propertyTypes?: PropertyTypeBucket[];
  /** Match if the row's auction year is in this list. */
  years?: number[];
  /** Match if the row's occupancy bucket is in this list. */
  occupancies?: OccupancyBucket[];
  /** Case-insensitive contains over the row's city. Single value (not multi). */
  city?: string;
}

export interface BrowsePage {
  mode: BrowseMode;
  rows: BrowseRow[];
  total: number;        // post-filter, pre-pagination
  page: number;         // 1-based
  pageSize: number;
  hasNext: boolean;
  generatedAt: string;  // sidecar generation time
  poolTotal: number;    // total rows in the mode-specific pool (e.g. only those with marketRatio for market mode)
}

const PAGE_SIZE = 50;

// ──────────────────────────────────────────────────────────────────────────
// Eager work at module init — typed cast + pool partitioning
// ──────────────────────────────────────────────────────────────────────────
const ALL_ROWS = sidecar.rows as BrowseRow[];

/** Subset of rows usable in market mode (have a non-null marketRatio). */
const MARKET_ROWS: BrowseRow[] = ALL_ROWS.filter(
  (r) => r.marketRatio != null
);

// Distinct dropdown values, computed once.
const TRIBUNALS: string[] = Array.from(
  new Set(ALL_ROWS.map((r) => r.tribunal).filter((x): x is string => !!x))
).sort((a, b) => a.localeCompare(b, "fr"));

const YEARS: number[] = Array.from(
  new Set(ALL_ROWS.map((r) => r.year).filter((x): x is number => x != null))
).sort((a, b) => b - a); // descending — most recent first

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────
export function distinctTribunals(): string[] {
  return TRIBUNALS;
}

export function distinctYears(): number[] {
  return YEARS;
}

/** Total row counts (mode-aware) — handy for empty-state copy. */
export function poolSize(mode: BrowseMode): number {
  return mode === "market" ? MARKET_ROWS.length : ALL_ROWS.length;
}

export function generatedAt(): string {
  return sidecar.generated_at;
}

export function queryBrowse(
  mode: BrowseMode,
  filters: BrowseFilters,
  page: number
): BrowsePage {
  const pool = mode === "market" ? MARKET_ROWS : ALL_ROWS;

  const cityNeedle = filters.city?.trim().toLowerCase();

  // Pre-compute "is filter active" once per filter so the hot path stays a
  // simple includes() check on a small array (1-30 entries each).
  const tribunals = filters.tribunals?.length ? filters.tribunals : null;
  const types = filters.propertyTypes?.length ? filters.propertyTypes : null;
  const years = filters.years?.length ? filters.years : null;
  const occs = filters.occupancies?.length ? filters.occupancies : null;

  const filtered = pool.filter((r) => {
    if (tribunals && (r.tribunal === null || !tribunals.includes(r.tribunal))) return false;
    if (types && !types.includes(r.propertyType)) return false;
    if (years && (r.year === null || !years.includes(r.year))) return false;
    if (occs && !occs.includes(r.occupancy)) return false;
    if (cityNeedle && !(r.city ?? "").toLowerCase().includes(cityNeedle)) return false;
    return true;
  });

  // Smaller is better in both modes (closer to floor / deeper market discount).
  filtered.sort((a, b) => {
    if (mode === "market") {
      // marketRatio is non-null for every row in MARKET_ROWS.
      return (a.marketRatio as number) - (b.marketRatio as number);
    }
    return a.uncontestedRatio - b.uncontestedRatio;
  });

  const safePage = Math.max(1, Math.floor(page) || 1);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  return {
    mode,
    rows: slice,
    total: filtered.length,
    page: safePage,
    pageSize: PAGE_SIZE,
    hasNext: filtered.length > start + PAGE_SIZE,
    generatedAt: sidecar.generated_at,
    poolTotal: pool.length,
  };
}
