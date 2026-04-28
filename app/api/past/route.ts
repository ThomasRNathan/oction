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

  const tribunal = sp.get("tribunal");
  if (tribunal && ALLOWED_TRIBUNALS.has(tribunal)) filters.tribunal = tribunal;

  const propertyType = sp.get("propertyType");
  if (propertyType && (PROPERTY_TYPES as readonly string[]).includes(propertyType)) {
    filters.propertyType = propertyType as PropertyTypeBucket;
  }

  const yearStr = sp.get("year");
  if (yearStr) {
    const y = parseInt(yearStr, 10);
    if (Number.isFinite(y) && ALLOWED_YEARS.has(y)) filters.year = y;
  }

  const occupancy = sp.get("occupancy");
  if (occupancy && (OCCUPANCIES as readonly string[]).includes(occupancy)) {
    filters.occupancy = occupancy as OccupancyBucket;
  }

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
