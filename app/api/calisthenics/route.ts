import { NextRequest, NextResponse } from "next/server";
import {
  filterByBbox,
  getCalisthenicsMeta,
  getCalisthenicsSpots,
  type Bbox,
} from "@/lib/calisthenics-parks/load-spots";

function parseBbox(raw: string | null): Bbox | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts as Bbox;
}

/**
 * GET /api/calisthenics — street workout spots for the world map.
 *
 * Query params:
 *   bbox=west,south,east,north  — optional viewport filter
 *   id=123                      — single spot (with detail if scraped)
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const idRaw = sp.get("id");

  if (idRaw) {
    const id = Number(idRaw);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const spot = getCalisthenicsSpots().find((s) => s.id === id);
    if (!spot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ spot });
  }

  const bbox = parseBbox(sp.get("bbox"));
  let spots = getCalisthenicsSpots();
  if (bbox) spots = filterByBbox(spots, bbox);

  return NextResponse.json({
    spots,
    meta: getCalisthenicsMeta(),
  });
}
