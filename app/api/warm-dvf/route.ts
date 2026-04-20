/**
 * POST /api/warm-dvf
 * Pre-populate the Supabase DVF cache for a given commune code.
 * Call this from a local machine (where CEREMA is reachable).
 *
 * Body: { code_insee: "92024", property_type?: "Appartement" }
 * Protected by a shared secret: Authorization: Bearer <WARM_SECRET>
 */
import { NextRequest, NextResponse } from "next/server";
import { getDVFAnalysis } from "@/lib/dvf";

export async function POST(req: NextRequest) {
  const secret = process.env.WARM_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { code_insee, property_type } = await req.json();
  if (!code_insee) {
    return NextResponse.json({ error: "code_insee required" }, { status: 400 });
  }

  const analysis = await getDVFAnalysis(0, 0, property_type, code_insee);
  if (!analysis) {
    return NextResponse.json({ error: "No DVF data found", code_insee }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    code_insee,
    property_type: property_type ?? null,
    median: analysis.medianPricePerSqm,
    count: analysis.count,
    cached: true,
  });
}
