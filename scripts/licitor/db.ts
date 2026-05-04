/**
 * Supabase admin client for scraper scripts.
 * Uses service role key (bypasses RLS) — DO NOT import into the Next.js app.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Next.js uses .env.local for local dev. Load both.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / ANON_KEY"
  );
}

export const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type IndexListing = {
  licitor_id: number;
  lot_index: number;
  url: string;
  region: string;
  department_code: string | null;
  city: string | null;
  property_type: string | null;
  property_description: string | null;
  index_date: string | null; // YYYY-MM-DD or null
  index_price: number | null;
  published_at: string | null; // YYYY-MM-DD or null
  status: "sold" | "upcoming" | "unknown";
};

export type DetailData = {
  licitor_id: number;
  tribunal: string | null;
  auction_date: string | null; // ISO
  property_type: string | null;
  property_description: string | null;
  surface: number | null;
  surface_annexe: number | null;
  occupancy: string | null;
  floor: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  mise_a_prix: number | null;
  adjudication_price: number | null;
  visit_date: string | null;
  lawyer_name: string | null;
  lawyer_firm: string | null;
  lawyer_address: string | null;
  published_at: string | null;
  status: "sold" | "upcoming" | "unsold" | "unknown";
  raw_html: string | null;
};

/** Upsert a batch of index listings into past_auctions. */
export async function upsertIndexListings(rows: IndexListing[]): Promise<void> {
  if (rows.length === 0) return;
  // Only write columns from the index — don't overwrite detail-filled columns
  const { error } = await db.from("past_auctions").upsert(
    rows.map((r) => ({
      licitor_id: r.licitor_id,
      lot_index: r.lot_index,
      url: r.url,
      region: r.region,
      department_code: r.department_code,
      city: r.city,
      property_type: r.property_type,
      property_description: r.property_description,
      index_date: r.index_date,
      index_price: r.index_price,
      published_at: r.published_at,
      status: r.status,
      last_fetched_at: new Date().toISOString(),
    })),
    { onConflict: "licitor_id,lot_index", ignoreDuplicates: false }
  );
  if (error) {
    // Surface Supabase's PostgrestError details — it isn't an Error instance.
    const pretty =
      typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error);
    throw new Error(pretty);
  }
}

/**
 * Drop keys whose value is `null` or `undefined`. Used by `writeDetail` to make
 * Supabase updates additive: the parser emits `null` for any field it didn't
 * find on the page, and we never want to overwrite an already-stored positive
 * value with `null`. Critical for re-detail-fetching a sold auction that was
 * previously detailed while upcoming — the post-sale page no longer carries
 * `visit_date`, but we want to keep the value captured during the upcoming
 * window.
 *
 * `0` and `""` are NOT stripped — those are legitimate parsed values.
 */
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/**
 * Update a row with detail-page data.
 *
 * Shared fields (tribunal, lawyer, auction_date, city, address, visit_date) are
 * written to ALL lots of the same announcement. Per-lot fields (property_type,
 * surface, mise_a_prix, adjudication_price) are only written to lot_index=0
 * because the detail parser currently only extracts the first SousLot.
 *
 * detail_fetched_at is set on all rows so the scraper doesn't re-fetch the
 * same URL for each lot.
 *
 * NULL-SAFE: each update payload is filtered through `compact()` so that fields
 * the parser couldn't extract (e.g. `visit_date` on a post-sale page) are
 * omitted from the SQL UPDATE rather than overwritten with NULL. The mandatory
 * timestamp fields (`detail_fetched_at`, `last_fetched_at`) and `status` are
 * always non-null so they always go through.
 */
export async function writeDetail(d: DetailData): Promise<void> {
  const now = new Date().toISOString();

  // 1. Shared fields — all lots of this announcement
  const { error: errShared } = await db
    .from("past_auctions")
    .update(
      compact({
        tribunal: d.tribunal,
        auction_date: d.auction_date,
        city: d.city,
        address: d.address,
        visit_date: d.visit_date,
        lawyer_name: d.lawyer_name,
        lawyer_firm: d.lawyer_firm,
        lawyer_address: d.lawyer_address,
        published_at: d.published_at,
        detail_fetched_at: now,
        last_fetched_at: now,
      })
    )
    .eq("licitor_id", d.licitor_id);
  if (errShared) throw new Error(JSON.stringify(errShared));

  // 2. Per-lot fields — only lot 0 (detail parser reads only first SousLot)
  const { error: errLot } = await db
    .from("past_auctions")
    .update(
      compact({
        property_type: d.property_type,
        property_description: d.property_description,
        surface: d.surface,
        surface_annexe: d.surface_annexe,
        occupancy: d.occupancy,
        floor: d.floor,
        mise_a_prix: d.mise_a_prix,
        adjudication_price: d.adjudication_price,
        status: d.status,
        raw_html: d.raw_html,
      })
    )
    .eq("licitor_id", d.licitor_id)
    .eq("lot_index", 0);
  if (errLot) throw new Error(JSON.stringify(errLot));
}

/** Mark a listing as removed (404 after earlier indexing). */
export async function markRemoved(licitor_id: number): Promise<void> {
  await db
    .from("past_auctions")
    .update({
      status: "removed",
      detail_fetched_at: new Date().toISOString(),
      last_fetched_at: new Date().toISOString(),
    })
    .eq("licitor_id", licitor_id);
}
