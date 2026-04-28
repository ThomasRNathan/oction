/**
 * Bake the past-auctions browse sidecar.
 *
 * Reads all sold rows from past_auctions (with mise_a_prix > 0 and a non-null
 * adjudication_price), normalizes the categorical fields, joins with the
 * pre-computed DVF locality medians, and writes a slim JSON artefact for the
 * `/historique` browse view to read in-memory at module init.
 *
 * Two ratios are pre-computed per row so the API route only needs to filter
 * and sort:
 *   - uncontestedRatio = adjudication_price / mise_a_prix - 1
 *   - marketRatio      = (adjudication_price / surface) / dvfMedianPerSqm
 *                        (null when surface or DVF lookup is missing)
 *
 * Usage:
 *   pnpm tsx scripts/analytics/bake-past-auctions-browse.ts
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeTribunal } from "../../lib/analytics/normalize-tribunal";
import {
  normalizePropertyType,
  type PropertyTypeBucket,
} from "../../lib/analytics/normalize-property-type";
import {
  normalizeOccupancy,
  type OccupancyBucket,
} from "../../lib/analytics/normalize-occupancy";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
type Row = {
  licitor_id: number;
  url: string | null;
  status: string | null;
  mise_a_prix: number | null;
  adjudication_price: number | null;
  surface: number | null;
  property_type: string | null;
  occupancy: string | null;
  tribunal: string | null;
  city: string | null;
  department_code: string | null;
  auction_date: string | null;
  address: string | null;
};

type DvfLocality = Record<
  string,
  { medianPerSqm: number; n: number; radiusUsed: number }
>;

/** What we serialise. Keep field names short — multiplied by ~12k rows. */
export type BrowseRow = {
  id: number;                         // licitor_id
  url: string | null;
  city: string | null;
  department: string | null;          // department_code
  propertyType: PropertyTypeBucket;
  tribunal: string | null;            // normalized: "TJ Paris" | "Notaire" | null
  occupancy: OccupancyBucket;         // "libre" | "occupé" | "loué" | null
  surface: number | null;
  miseAPrix: number;
  adjudication: number;
  auctionDate: string | null;         // ISO date prefix YYYY-MM-DD
  year: number | null;
  uncontestedRatio: number;           // adj/MAP - 1 (smaller is better)
  marketRatio: number | null;         // adj_per_sqm / dvf_per_sqm (smaller = deeper discount)
};

export type BrowseSidecar = {
  generated_at: string;
  n_total: number;
  n_with_market_score: number;
  rows: BrowseRow[];
};

// ──────────────────────────────────────────────────────────────────────────
// DVF locality lookup
// ──────────────────────────────────────────────────────────────────────────
function loadDvf(): DvfLocality {
  const path = resolve(process.cwd(), "lib/analytics/dvf-by-locality.json");
  return JSON.parse(readFileSync(path, "utf8")) as DvfLocality;
}

function localityKey(
  city: string | null,
  dep: string | null,
  type: PropertyTypeBucket
): string {
  return `${(city ?? "").trim().toLowerCase()}|${dep ?? ""}|${type}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("# Bake past-auctions-browse sidecar");

  const dvf = loadDvf();
  console.log(`Loaded ${Object.keys(dvf).length} DVF locality entries.`);

  const pageSize = 1000;
  let from = 0;
  const raw: Row[] = [];
  while (true) {
    const { data, error } = await db
      .from("past_auctions")
      .select(
        "licitor_id, url, status, mise_a_prix, adjudication_price, surface, property_type, occupancy, tribunal, city, department_code, auction_date, address"
      )
      .eq("status", "sold")
      .not("mise_a_prix", "is", null)
      .not("adjudication_price", "is", null)
      .gt("mise_a_prix", 0)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    raw.push(...(data as Row[]));
    process.stdout.write(`  fetched ${raw.length} rows…\r`);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`\nFetched ${raw.length} sold rows with both prices.`);

  const rows: BrowseRow[] = [];
  let withMarket = 0;
  for (const r of raw) {
    if (r.mise_a_prix == null || r.adjudication_price == null) continue;
    if (Number(r.mise_a_prix) <= 0) continue;

    const propertyType = normalizePropertyType(r.property_type);
    const tribunal = normalizeTribunal(r.tribunal);
    const occupancy = normalizeOccupancy(r.occupancy);

    const map = Number(r.mise_a_prix);
    const adj = Number(r.adjudication_price);
    const surface = r.surface == null ? null : Number(r.surface);

    const auctionDate =
      r.auction_date && /^\d{4}-\d{2}-\d{2}/.test(r.auction_date)
        ? r.auction_date.slice(0, 10)
        : null;
    const year = auctionDate ? parseInt(auctionDate.slice(0, 4), 10) : null;

    let marketRatio: number | null = null;
    if (surface != null && surface > 0) {
      const dvfRow = dvf[localityKey(r.city, r.department_code, propertyType)];
      if (dvfRow && dvfRow.medianPerSqm > 0) {
        marketRatio = round4(adj / surface / dvfRow.medianPerSqm);
        withMarket++;
      }
    }

    rows.push({
      id: r.licitor_id,
      url: r.url ?? null,
      city: r.city ?? null,
      department: r.department_code ?? null,
      propertyType,
      tribunal: tribunal ?? null,
      occupancy,
      surface: surface ?? null,
      miseAPrix: map,
      adjudication: adj,
      auctionDate,
      year,
      uncontestedRatio: round4(adj / map - 1),
      marketRatio,
    });
  }

  // Stable order by id so re-bakes produce a stable diff.
  rows.sort((a, b) => a.id - b.id);

  const sidecar: BrowseSidecar = {
    generated_at: new Date().toISOString(),
    n_total: rows.length,
    n_with_market_score: withMarket,
    rows,
  };

  const outPath = resolve(process.cwd(), "lib/data/past-auctions-browse.json");
  writeFileSync(outPath, JSON.stringify(sidecar));
  const sizeKb = Math.round(JSON.stringify(sidecar).length / 1024);
  console.log(
    `\n✓ Wrote ${outPath}\n  n_total=${rows.length} n_with_market_score=${withMarket} size=${sizeKb} KB`
  );

  // Quick year breakdown so we can sanity-check coverage
  const byYear = new Map<number | null, number>();
  for (const r of rows) byYear.set(r.year, (byYear.get(r.year) ?? 0) + 1);
  console.log("\nBy year:");
  for (const [y, n] of [...byYear].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))) {
    console.log(`  ${y ?? "?"}: ${n}`);
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
