import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AnalysisResult } from "./types";

/**
 * Lazy Supabase client.
 *
 * Earlier we did `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)` at
 * module load. When NEXT_PUBLIC_* vars are missing (e.g. Vercel Preview env
 * where they were never configured) the client throws "supabaseUrl is
 * required" the first time any module in the import graph is evaluated —
 * which kills `next build`'s page-data collection for unrelated routes that
 * merely transit `lib/supabase` through a chain of imports.
 *
 * The Proxy below preserves the `import { supabase } from "./supabase"` API
 * for every existing caller, but defers `createClient` until a method is
 * actually called. If env vars are still missing at that point we throw a
 * clear error instead of the cryptic "supabaseUrl is required" from inside
 * Supabase internals.
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in this environment."
    );
  }
  _client = createClient(url, key);
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});

/** Persist an analysis to Supabase. Fire-and-forget — never throws. */
export async function saveAnalysis(
  url: string,
  result: AnalysisResult
): Promise<void> {
  try {
    const { property, dvf, verdict, attractiveness } = result;

    await supabase.from("analyses").insert({
      url,
      listing_id: property.id,

      // property
      property_type: property.type,
      address: property.address,
      city: property.city,
      arrondissement: property.arrondissement,
      surface: property.surface,
      occupancy: property.occupancy,
      mise_a_prix: property.miseAPrix,
      auction_date: property.auctionDate,
      tribunal: property.tribunal,
      visit_date: property.visitDate,

      // dvf
      dvf_median_price_sqm: dvf?.medianPricePerSqm,
      dvf_count: dvf?.count,
      dvf_period_years: dvf?.periodYears,

      // verdict
      verdict_rating: verdict?.rating,
      verdict_discount_pct: verdict?.discountPercent,

      // attractiveness
      attractiveness_score: attractiveness?.score,
      attractiveness_label: attractiveness?.label,

      // full JSON payloads
      raw_property: property,
      raw_dvf: dvf ?? null,
      raw_verdict: verdict ?? null,
      raw_attractiveness: attractiveness ?? null,
    });
  } catch {
    // never break the user flow if DB write fails
  }
}
