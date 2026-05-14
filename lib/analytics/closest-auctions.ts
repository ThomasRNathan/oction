/**
 * "Ventes similaires récentes" — find recent past auctions that are
 * close to a live listing, to give the user concrete comps right after
 * the analyse.
 *
 * Reads from the pre-baked past-auctions sidecar
 * (lib/data/past-auctions-browse.json). Pure in-memory filter+sort —
 * runs inside POST /api/analyze without touching the DB.
 *
 * Closeness tiers (most specific wins, all gated on same property-type
 * bucket when one is provided):
 *
 *   tier 3 — same city (e.g. "Paris 18ème" matches "Paris 18ème" or
 *            "Paris 18ème (P18)")
 *   tier 2 — same tribunal (normalized labels, e.g. "TJ Paris")
 *   tier 1 — same département (INSEE code, e.g. "75")
 *
 * Within a tier we sort by `auctionDate` descending so the result is
 * always biased toward recent comps.
 */
import sidecar from "@/lib/data/past-auctions-browse.json";
import type { PropertyTypeBucket } from "@/lib/analytics/normalize-property-type";
import { normalizeTribunal } from "@/lib/analytics/normalize-tribunal";

interface SidecarRow {
  id: number;
  url: string | null;
  city: string | null;
  department: string | null;
  propertyType: PropertyTypeBucket;
  tribunal: string | null;
  surface: number | null;
  miseAPrix: number;
  adjudication: number;
  auctionDate: string | null;
  year: number | null;
}

const ALL_ROWS = sidecar.rows as SidecarRow[];

export type ClosestScope = "city" | "tribunal" | "department";

export interface ClosestAuction {
  id: number;
  url: string | null;
  city: string | null;
  department: string | null;
  propertyType: PropertyTypeBucket;
  tribunal: string | null;
  surface: number | null;
  miseAPrix: number;
  adjudication: number;
  auctionDate: string | null;
  /** How we matched this row to the live listing — surfaced in the UI. */
  scope: ClosestScope;
}

export interface FindClosestOpts {
  /** Live city key, e.g. "Paris 18ème" or "Nanterre". */
  city?: string | null;
  /** Live tribunal raw text — gets normalized internally. */
  tribunal?: string | null;
  /** Live département INSEE code (2 chars), e.g. "75". */
  department?: string | null;
  /** Live property-type bucket. When omitted, no type gate. */
  propertyTypeBucket?: PropertyTypeBucket;
  /** Exclude this listing id from the result (avoid showing the live lot
   *  as one of its own neighbours when it's already been baked). */
  excludeId?: number | string | null;
  /** Default 5. */
  limit?: number;
}

/**
 * Normalize a sidecar city string for comparison — strips trailing
 * parentheticals ("Paris 18ème (P18)" → "paris 18ème") and lowercases.
 */
function normCity(s: string | null | undefined): string | null {
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim();
}

/**
 * Build the city key from a live property (e.g. `city: "Paris",
 * arrondissement: 18` → `"Paris 18ème"`).
 */
export function buildCityKey(
  city: string | null | undefined,
  arrondissement: number | null | undefined
): string | null {
  if (!city) return null;
  const cityLc = city.toLowerCase();
  // Only append arrondissement for the three métropoles that use them in
  // the sidecar's city field.
  if (
    arrondissement != null &&
    (cityLc === "paris" || cityLc === "lyon" || cityLc === "marseille")
  ) {
    const ord = arrondissement === 1 ? "1er" : `${arrondissement}ème`;
    return `${city} ${ord}`;
  }
  return city;
}

export function findClosestAuctions(opts: FindClosestOpts): ClosestAuction[] {
  const limit = Math.max(1, opts.limit ?? 5);

  const cityKey = normCity(opts.city ?? null);
  const liveTrib = normalizeTribunal(opts.tribunal ?? null);
  const dept = opts.department?.trim() || null;
  const bucket = opts.propertyTypeBucket;
  const excludeId =
    opts.excludeId != null ? Number(opts.excludeId) : null;

  if (!cityKey && !liveTrib && !dept) return [];

  const scored: Array<{
    row: SidecarRow;
    tier: number;
    scope: ClosestScope;
  }> = [];

  for (const r of ALL_ROWS) {
    if (!r.adjudication || !r.auctionDate) continue;
    if (excludeId != null && r.id === excludeId) continue;
    if (bucket && r.propertyType !== bucket) continue;

    let tier = 0;
    let scope: ClosestScope = "department";

    if (cityKey && normCity(r.city) === cityKey) {
      tier = 3;
      scope = "city";
    } else if (liveTrib && r.tribunal && normalizeTribunal(r.tribunal) === liveTrib) {
      tier = 2;
      scope = "tribunal";
    } else if (dept && r.department === dept) {
      tier = 1;
      scope = "department";
    }

    if (tier > 0) scored.push({ row: r, tier, scope });
  }

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier;
    // Same tier — most recent first. auctionDate is ISO "YYYY-MM-DD" so
    // lexicographic compare equals chronological.
    return (b.row.auctionDate ?? "").localeCompare(a.row.auctionDate ?? "");
  });

  return scored.slice(0, limit).map(({ row, scope }) => ({
    id: row.id,
    url: row.url,
    city: row.city,
    department: row.department,
    propertyType: row.propertyType,
    tribunal: row.tribunal,
    surface: row.surface,
    miseAPrix: row.miseAPrix,
    adjudication: row.adjudication,
    auctionDate: row.auctionDate,
    scope,
  }));
}
