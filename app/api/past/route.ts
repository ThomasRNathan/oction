import { NextRequest, NextResponse } from "next/server";
import {
  queryBrowse,
  distinctTribunals,
  distinctYears,
  poolSize,
  generatedAt,
  type BrowseFilters,
  type BrowseMode,
} from "@/lib/analytics/past-browse";
import type { PropertyTypeBucket } from "@/lib/analytics/normalize-property-type";
import type { OccupancyBucket } from "@/lib/analytics/normalize-occupancy";

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
const OCCUPANCIES: readonly OccupancyBucket[] = ["libre", "occupé", "loué"];

const ALLOWED_TRIBUNALS = new Set(distinctTribunals());
const ALLOWED_YEARS = new Set(distinctYears());

/**
 * GET /api/past — paged browse over the pre-baked past-auctions sidecar.
 *
 * All processing is pure JS over the in-memory JSON loaded at module init by
 * lib/analytics/past-browse.ts. No DB call. No external fetch.
 *
 * Returns an extra `meta` block on page=1 so the client can populate filter
 * dropdowns without a second round-trip.
 */
export function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const mode: BrowseMode = sp.get("mode") === "market" ? "market" : "uncontested";

  const filters: BrowseFilters = {};

  // Repeated params are decoded with .getAll() — e.g. ?tribunal=A&tribunal=B.
  // Each value is whitelisted against the allow-set so a malformed query can
  // never reach the in-memory pool with garbage.
  const tribunalSel = sp.getAll("tribunal").filter((t) => ALLOWED_TRIBUNALS.has(t));
  if (tribunalSel.length) filters.tribunals = tribunalSel;

  const typeSel = sp
    .getAll("propertyType")
    .filter((t): t is PropertyTypeBucket =>
      (PROPERTY_TYPES as readonly string[]).includes(t)
    );
  if (typeSel.length) filters.propertyTypes = typeSel;

  const yearSel = sp
    .getAll("year")
    .map((y) => parseInt(y, 10))
    .filter((y) => Number.isFinite(y) && ALLOWED_YEARS.has(y));
  if (yearSel.length) filters.years = yearSel;

  const occSel = sp
    .getAll("occupancy")
    .filter((o): o is Exclude<OccupancyBucket, null> =>
      (OCCUPANCIES as readonly string[]).includes(o)
    );
  if (occSel.length) filters.occupancies = occSel;

  const city = sp.get("city");
  if (city && city.trim()) filters.city = city.trim();

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const result = queryBrowse(mode, filters, page);

  // Send dropdown options back on the first page so the client can populate
  // them without a second round-trip. Cheap — these are tiny string arrays.
  const includeMeta = page === 1;

  return NextResponse.json({
    ...result,
    ...(includeMeta && {
      meta: {
        tribunals: distinctTribunals(),
        years: distinctYears(),
        propertyTypes: PROPERTY_TYPES,
        occupancies: OCCUPANCIES,
        poolSizeUncontested: poolSize("uncontested"),
        poolSizeMarket: poolSize("market"),
        generatedAt: generatedAt(),
      },
    }),
  });
}
