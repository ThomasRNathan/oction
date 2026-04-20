import { createClient } from "@supabase/supabase-js";
import { AnalysisResult } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
