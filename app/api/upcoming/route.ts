import { NextRequest, NextResponse } from "next/server";
import {
  getUpcomingMeta,
  queryUpcoming,
  type UpcomingFilters,
  type UpcomingSort,
} from "@/lib/analytics/upcoming-browse";
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
const OCCUPANCIES: readonly Exclude<OccupancyBucket, null>[] = [
  "libre",
  "occupé",
  "loué",
];
const SORTS: readonly UpcomingSort[] = ["date", "decote", "map_asc", "map_desc"];

function parseNum(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/upcoming — paged browse over LIVE upcoming auctions.
 *
 * Data is loaded once per ~5 min from Supabase (status='upcoming' AND
 * auction_date >= NOW()). Filters and sort are applied in-memory, so the hot
 * path is sub-50 ms after the first cold fetch.
 *
 * The `meta` block on page=1 carries the filter dropdown allow-lists plus the
 * MAP/DVF observed [min, max] so the client can render slider hints.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const filters: UpcomingFilters = {};

  const tribunalSel = sp.getAll("tribunal").filter((t) => t.length > 0);
  if (tribunalSel.length) filters.tribunals = tribunalSel;

  const typeSel = sp
    .getAll("propertyType")
    .filter((t): t is PropertyTypeBucket =>
      (PROPERTY_TYPES as readonly string[]).includes(t)
    );
  if (typeSel.length) filters.propertyTypes = typeSel;

  const occSel = sp
    .getAll("occupancy")
    .filter((o): o is Exclude<OccupancyBucket, null> =>
      (OCCUPANCIES as readonly string[]).includes(o)
    );
  if (occSel.length) filters.occupancies = occSel;

  const city = sp.get("city");
  if (city && city.trim()) filters.city = city.trim();

  const mapMin = parseNum(sp.get("mapMin"));
  if (mapMin != null && mapMin >= 0) filters.mapMin = mapMin;
  const mapMax = parseNum(sp.get("mapMax"));
  if (mapMax != null && mapMax >= 0) filters.mapMax = mapMax;
  const dvfMin = parseNum(sp.get("dvfMin"));
  if (dvfMin != null && dvfMin >= 0) filters.dvfMin = dvfMin;
  const dvfMax = parseNum(sp.get("dvfMax"));
  if (dvfMax != null && dvfMax >= 0) filters.dvfMax = dvfMax;

  const withinDays = parseNum(sp.get("withinDays"));
  if (withinDays != null && withinDays >= 0) filters.withinDays = withinDays;

  const rawSort = sp.get("sort") as UpcomingSort | null;
  const sort: UpcomingSort =
    rawSort && SORTS.includes(rawSort) ? rawSort : "date";

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  try {
    const result = await queryUpcoming(filters, sort, page);
    const includeMeta = page === 1;
    const meta = includeMeta ? await getUpcomingMeta() : undefined;

    return NextResponse.json({ ...result, ...(meta && { meta }) });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Erreur de chargement upcoming",
      },
      { status: 500 }
    );
  }
}
