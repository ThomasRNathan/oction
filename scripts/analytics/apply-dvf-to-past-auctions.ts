/**
 * Apply DVF enrichment to past_auctions rows.
 *
 * Reads the (city × department × bucket) → DVF median cache built by
 * `enrich-past-auctions-dvf.ts` and writes `dvf_median_per_sqm`,
 * `dvf_tx_count`, `dvf_radius_used_m`, `dvf_property_bucket`, and
 * `dvf_enriched_at` onto each eligible row.
 *
 * `dvf_expected_price` and `adj_dvf_ratio` are GENERATED ALWAYS columns —
 * they update themselves whenever `dvf_median_per_sqm`, `surface`, or
 * `adjudication_price` change.
 *
 * Resumable: pass --refresh to overwrite rows that already have a value;
 * default (no flag) skips rows whose dvf_median_per_sqm is already set.
 *
 * Usage:
 *   pnpm tsx scripts/analytics/apply-dvf-to-past-auctions.ts            # full pass, skip already-set
 *   pnpm tsx scripts/analytics/apply-dvf-to-past-auctions.ts --refresh  # overwrite everything
 *   pnpm tsx scripts/analytics/apply-dvf-to-past-auctions.ts --limit 100  # smoke test
 *   pnpm tsx scripts/analytics/apply-dvf-to-past-auctions.ts --dry      # log, no writes
 *   pnpm tsx scripts/analytics/apply-dvf-to-past-auctions.ts --status upcoming
 *       # enrich the live upcoming pool instead of sold history (no
 *       # adjudication_price requirement — powers the /upcoming décote
 *       # column and the home-page radar). Run daily by the launchd cron.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizePropertyType,
  type PropertyTypeBucket,
} from "../../lib/analytics/normalize-property-type";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const hasFlag = (n: string) => args.includes(`--${n}`);
const flagVal = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const refresh = hasFlag("refresh");
const dryRun = hasFlag("dry");
const limit = flagVal("limit") ? Number(flagVal("limit")) : Infinity;
const batchSize = Number(flagVal("batch") ?? "200");
const status = flagVal("status") ?? "sold";
if (status !== "sold" && status !== "upcoming")
  throw new Error(`--status must be "sold" or "upcoming", got "${status}"`);

// ── Supabase (Marketplace-native: @supabase/supabase-js) ───────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key)
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or service role key");

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── DVF locality cache (built by enrich-past-auctions-dvf.ts) ──────────────
type Locality = { medianPerSqm: number; n: number; radiusUsed: number };
const localityPath = resolve(
  process.cwd(),
  "lib/analytics/dvf-by-locality.json"
);
const locality: Record<string, Locality> = JSON.parse(
  readFileSync(localityPath, "utf8")
);
console.log(`Loaded ${Object.keys(locality).length} locality keys`);

function localityKey(
  city: string | null,
  dep: string | null,
  type: PropertyTypeBucket
): string {
  return `${(city ?? "").trim().toLowerCase()}|${dep ?? ""}|${type}`;
}

// Some buckets share a DVF entry — e.g. "studio" is filed under "appartement"
// in DVF. Mirror the fallbacks used by the enrich script.
function lookupLocality(
  city: string | null,
  dep: string | null,
  type: PropertyTypeBucket
): Locality | null {
  const tries: PropertyTypeBucket[] =
    type === "studio" ? ["studio", "appartement"] : [type];
  for (const t of tries) {
    const v = locality[localityKey(city, dep, t)];
    if (v) return v;
  }
  return null;
}

// ── Eligible row scan ──────────────────────────────────────────────────────
interface Row {
  licitor_id: string;
  city: string | null;
  department_code: string | null;
  property_type: string | null;
  surface: number | null;
  adjudication_price: number | null;
  dvf_median_per_sqm: number | null;
}

async function fetchEligible(): Promise<Row[]> {
  const pageSize = 1000;
  const out: Row[] = [];
  let from = 0;
  while (true) {
    let q = db
      .from("past_auctions")
      .select(
        "licitor_id, city, department_code, property_type, surface, adjudication_price, dvf_median_per_sqm"
      )
      .eq("status", status)
      .gt("surface", 0)
      .not("city", "is", null);
    // Upcoming rows have no adjudication yet — only require it for sold.
    if (status === "sold") q = q.gt("adjudication_price", 0);
    if (!refresh) q = q.is("dvf_median_per_sqm", null);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as Row[]));
    if (data.length < pageSize) break;
    from += pageSize;
    if (out.length >= limit) break;
  }
  return out.slice(0, Number.isFinite(limit) ? limit : out.length);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `# Apply DVF → past_auctions  (refresh=${refresh} dry=${dryRun} limit=${limit})`
  );

  const rows = await fetchEligible();
  console.log(`Eligible rows: ${rows.length}`);
  if (rows.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Phase 1: resolve each row's DVF locality
  const updates: Array<{
    licitor_id: string;
    dvf_median_per_sqm: number;
    dvf_tx_count: number;
    dvf_radius_used_m: number;
    dvf_property_bucket: PropertyTypeBucket;
    dvf_enriched_at: string;
  }> = [];
  let unmatched = 0;
  const unmatchedKeys = new Map<string, number>();
  const now = new Date().toISOString();
  for (const r of rows) {
    const bucket = normalizePropertyType(r.property_type);
    const loc = lookupLocality(r.city, r.department_code, bucket);
    if (!loc) {
      unmatched++;
      const k = localityKey(r.city, r.department_code, bucket);
      unmatchedKeys.set(k, (unmatchedKeys.get(k) ?? 0) + 1);
      continue;
    }
    updates.push({
      licitor_id: r.licitor_id,
      dvf_median_per_sqm: loc.medianPerSqm,
      dvf_tx_count: loc.n,
      dvf_radius_used_m: loc.radiusUsed,
      dvf_property_bucket: bucket,
      dvf_enriched_at: now,
    });
  }
  console.log(
    `Resolved: ${updates.length}  Unmatched: ${unmatched}  (top miss keys below)`
  );
  if (unmatched) {
    const top = [...unmatchedKeys.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    for (const [k, n] of top) console.log(`  ${n}\t${k}`);
  }

  if (dryRun) {
    console.log("\n--dry: skipping writes.");
    return;
  }

  // Phase 2: per-row UPDATEs (concurrency-pooled). The table has no unique
  // constraint on licitor_id, so upsert+ON CONFLICT is rejected by Postgres —
  // and update-only is what we mean anyway: never create rows here, just
  // stamp DVF columns onto existing ones (generated cols recompute).
  let done = 0;
  let writeFailed = 0;
  const t0 = Date.now();
  const CONCURRENCY = Math.max(1, Math.min(batchSize, 10));
  let cursor = 0;
  async function writeWorker() {
    while (cursor < updates.length) {
      const u = updates[cursor++];
      const { licitor_id, ...cols } = u;
      const { error } = await db
        .from("past_auctions")
        .update(cols)
        .eq("licitor_id", licitor_id);
      if (error) {
        writeFailed++;
        if (writeFailed <= 3)
          console.error(`update ${licitor_id} failed:`, error.message);
      }
      done++;
      if (done % 100 === 0 || done === updates.length) report();
    }
  }
  function report() {
    const elapsed = (Date.now() - t0) / 1000;
    const rate = done / Math.max(elapsed, 0.01);
    const eta = Math.round((updates.length - done) / Math.max(rate, 0.01));
    console.log(
      `[${done}/${updates.length}]  ${rate.toFixed(0)}/s  eta=${eta}s`
    );
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, updates.length) }, writeWorker)
  );

  console.log(
    `\nDone. Wrote ${updates.length - writeFailed}/${updates.length} rows in ${(
      (Date.now() - t0) / 1000
    ).toFixed(0)}s.${writeFailed ? ` ${writeFailed} failed.` : ""}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
