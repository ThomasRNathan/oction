import { NextResponse } from "next/server";
import { getUpcomingHighlights } from "@/lib/analytics/upcoming-browse";

/**
 * GET /api/highlights — curated picks + pool stats for the home-page deal
 * radar. Served from the same 5-min in-memory pool as /api/upcoming, so the
 * hot path costs no extra Supabase round-trip.
 */
export async function GET() {
  try {
    const highlights = await getUpcomingHighlights();
    return NextResponse.json(highlights);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Erreur de chargement highlights",
      },
      { status: 500 }
    );
  }
}
