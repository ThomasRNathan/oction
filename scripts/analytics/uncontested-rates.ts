/**
 * Offline analytics — uncontested-auction rates by feature.
 *
 * Reads all `sold` rows from past_auctions, computes the binary outcome
 *   y = (adjudication_price / mise_a_prix - 1) <= threshold
 * for a configurable threshold (default 0.01 = "essentially uncontested"),
 * then prints uncontested rates by tribunal, property_type, surface bucket,
 * mise_a_prix bucket, occupancy, month, nb-lots, etc.
 *
 * Also writes a machine-readable JSON artefact at
 * lib/analytics/uncontested-rates.json (when --emit-json is passed) which
 * the live analyzer imports to compute P(uncontested) per request.
 *
 * Usage:
 *   pnpm tsx scripts/analytics/uncontested-rates.ts                     # default threshold 0.01, no emit
 *   pnpm tsx scripts/analytics/uncontested-rates.ts --threshold 0       # exact equality
 *   pnpm tsx scripts/analytics/uncontested-rates.ts --threshold 0.05    # within 5%
 *   pnpm tsx scripts/analytics/uncontested-rates.ts --emit-json         # bake lib/analytics/uncontested-rates.json
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
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

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const threshold = Number(flag("threshold") ?? "0.01");
const emitJson = args.includes("--emit-json");
const outputPath = flag("output");
const definition = (flag("definition") ?? "threshold") as "threshold" | "market";
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
  console.error(`Invalid --threshold ${threshold} (must be 0..1)`);
  process.exit(1);
}
if (definition !== "threshold" && definition !== "market") {
  console.error(`Invalid --definition ${definition} (must be threshold|market)`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// DB
// ──────────────────────────────────────────────────────────────────────────
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
  lot_index: number;
  status: string | null;
  mise_a_prix: number | null;
  adjudication_price: number | null;
  surface: number | null;
  property_type: string | null;
  occupancy: string | null;
  tribunal: string | null;
  city: string | null;
  auction_date: string | null;
  department_code: string | null;
};

type Engineered = {
  y: 0 | 1;
  tribunal_norm: string;
  property_type_norm: PropertyTypeBucket;
  occupancy_norm: OccupancyBucket;
  surface_bucket: string;
  mise_bucket: string;
  mise_per_sqm_bucket: string;
  month: number;
  year: number;
  nb_lots_meme_audience: number;
  nb_lots_meme_annonce: number;
  is_first_lot: boolean;
  mise_a_prix: number;
};

// ──────────────────────────────────────────────────────────────────────────
// Bucketing
// ──────────────────────────────────────────────────────────────────────────
function surfaceBucket(s: number | null): string {
  if (s == null) return "?";
  if (s < 20) return "<20 m²";
  if (s < 40) return "20–40 m²";
  if (s < 60) return "40–60 m²";
  if (s < 100) return "60–100 m²";
  if (s < 150) return "100–150 m²";
  return ">150 m²";
}
function miseBucket(m: number): string {
  if (m < 50_000) return "<50k €";
  if (m < 100_000) return "50–100k €";
  if (m < 200_000) return "100–200k €";
  if (m < 500_000) return "200–500k €";
  return ">500k €";
}
function misePerSqmBucket(m: number, s: number | null): string {
  if (s == null || s <= 0) return "?";
  const pps = m / s;
  if (pps < 1000) return "<1k €/m²";
  if (pps < 2000) return "1–2k €/m²";
  if (pps < 4000) return "2–4k €/m²";
  if (pps < 7000) return "4–7k €/m²";
  return ">7k €/m²";
}
function nbLotsBucket(n: number): string {
  if (n === 1) return "1";
  if (n <= 3) return "2–3";
  if (n <= 10) return "4–10";
  return "11+";
}

// ──────────────────────────────────────────────────────────────────────────
// Aggregation helpers
// ──────────────────────────────────────────────────────────────────────────
type RateCell = { n: number; n_uncontested: number; rate: number; lift: number; ci_low: number; ci_high: number };

function makeCell(n_uncontested: number, n: number, baseline: number): RateCell {
  const rate = n > 0 ? n_uncontested / n : 0;
  // Wilson 95% CI for binomial proportion — more honest than ±1.96·SE/√n
  // when rate is near 0 or 1, which it often is in our buckets.
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = (rate + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((rate * (1 - rate)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    n,
    n_uncontested,
    rate: round4(rate),
    lift: baseline > 0 ? round3(rate / baseline) : 1,
    ci_low: round4(Math.max(0, center - margin)),
    ci_high: round4(Math.min(1, center + margin)),
  };
}

function aggBy<K extends string | number>(
  rows: Engineered[],
  keyFn: (r: Engineered) => K | null,
  baseline: number
): Map<K, RateCell> {
  const counts = new Map<K, [n_unc: number, n: number]>();
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null) continue;
    const cur = counts.get(k) ?? [0, 0];
    cur[0] += r.y;
    cur[1] += 1;
    counts.set(k, cur);
  }
  const out = new Map<K, RateCell>();
  for (const [k, [u, n]] of counts) out.set(k, makeCell(u, n, baseline));
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ──────────────────────────────────────────────────────────────────────────
// Pretty-printer
// ──────────────────────────────────────────────────────────────────────────
function fmtPct(p: number): string {
  return (p * 100).toFixed(2) + "%";
}
function fmtLift(l: number): string {
  if (l >= 1) return `×${l.toFixed(2)}`;
  return `×${l.toFixed(2)}`;
}
function printTable(title: string, rows: Array<{ key: string; cell: RateCell }>) {
  rows.sort((a, b) => b.cell.rate - a.cell.rate);
  console.log(`\n### ${title}\n`);
  console.log("| bucket | n | n_unc | rate | 95% CI | lift |");
  console.log("|---|---:|---:|---:|---|---:|");
  for (const { key, cell } of rows) {
    const ci = `[${fmtPct(cell.ci_low)} ; ${fmtPct(cell.ci_high)}]`;
    console.log(
      `| ${key} | ${cell.n} | ${cell.n_uncontested} | ${fmtPct(cell.rate)} | ${ci} | ${fmtLift(cell.lift)} |`
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
/** DVF-by-locality keyed by `${city}|${department_code}|${type_norm}`. */
type DvfLocality = Record<string, { medianPerSqm: number; n: number; radiusUsed: number }>;

async function loadDvfLocality(): Promise<DvfLocality> {
  const { readFileSync } = await import("node:fs");
  const path = resolve(process.cwd(), "lib/analytics/dvf-by-locality.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as DvfLocality;
  } catch (e) {
    throw new Error(
      `--definition market requires lib/analytics/dvf-by-locality.json; ` +
        `run scripts/analytics/enrich-past-auctions-dvf.ts first. (${(e as Error).message})`
    );
  }
}

function localityKey(city: string | null, dep: string | null, type: PropertyTypeBucket): string {
  return `${(city ?? "").trim().toLowerCase()}|${dep ?? ""}|${type}`;
}

async function main() {
  console.log(`# Uncontested-auction analysis`);
  if (definition === "threshold") {
    console.log(`Definition: adj/MAP ≤ 1 + ${threshold} (i.e. ≤ +${(threshold * 100).toFixed(1)}%)`);
  } else {
    console.log(`Definition: adj/m² ≤ 0.6 × DVF/m² (≥40% under market)`);
  }

  // Fetch all sold rows. Supabase capped at 1000/page — page through.
  const pageSize = 1000;
  let from = 0;
  const raw: Row[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await db
      .from("past_auctions")
      .select(
        "licitor_id, lot_index, status, mise_a_prix, adjudication_price, surface, property_type, occupancy, tribunal, city, auction_date, department_code"
      )
      .eq("status", "sold")
      .not("mise_a_prix", "is", null)
      .not("adjudication_price", "is", null)
      .gt("mise_a_prix", 0)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    raw.push(...(data as Row[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`\nFetched ${raw.length} sold rows with both prices.`);

  // Pre-compute audience and announcement counts
  const audienceKey = (r: Row): string =>
    `${(r.auction_date ?? "").slice(0, 10)}|${normalizeTribunal(r.tribunal) ?? "?"}`;
  const audienceCounts = new Map<string, number>();
  const annonceCounts = new Map<number, number>();
  for (const r of raw) {
    audienceCounts.set(audienceKey(r), (audienceCounts.get(audienceKey(r)) ?? 0) + 1);
    annonceCounts.set(r.licitor_id, (annonceCounts.get(r.licitor_id) ?? 0) + 1);
  }

  // For --definition market we need DVF-by-locality before iterating rows.
  const dvfLocality = definition === "market" ? await loadDvfLocality() : null;
  let skipped_no_dvf = 0;
  let skipped_no_surface = 0;

  // Engineer features
  const eng: Engineered[] = [];
  for (const r of raw) {
    if (r.mise_a_prix == null || r.adjudication_price == null || r.mise_a_prix <= 0) continue;
    let y: 0 | 1;
    const tNorm = normalizePropertyType(r.property_type);
    if (definition === "threshold") {
      const ratio = Number(r.adjudication_price) / Number(r.mise_a_prix);
      y = ratio <= 1 + threshold ? 1 : 0;
    } else {
      // market: adj/m² ≤ 0.6 × DVF/m²
      if (r.surface == null || Number(r.surface) <= 0) {
        skipped_no_surface++;
        continue;
      }
      const k = localityKey(r.city, r.department_code, tNorm);
      const dvf = dvfLocality![k];
      if (!dvf) {
        skipped_no_dvf++;
        continue;
      }
      const adjPerSqm = Number(r.adjudication_price) / Number(r.surface);
      y = adjPerSqm <= 0.6 * dvf.medianPerSqm ? 1 : 0;
    }
    const tribunal_norm = normalizeTribunal(r.tribunal) ?? "Autre";
    const dt = r.auction_date ? new Date(r.auction_date) : null;
    const month = dt ? dt.getUTCMonth() + 1 : 0;
    const year = dt ? dt.getUTCFullYear() : 0;
    eng.push({
      y,
      tribunal_norm,
      property_type_norm: tNorm,
      occupancy_norm: normalizeOccupancy(r.occupancy),
      surface_bucket: surfaceBucket(r.surface == null ? null : Number(r.surface)),
      mise_bucket: miseBucket(Number(r.mise_a_prix)),
      mise_per_sqm_bucket: misePerSqmBucket(
        Number(r.mise_a_prix),
        r.surface == null ? null : Number(r.surface)
      ),
      month,
      year,
      nb_lots_meme_audience: audienceCounts.get(audienceKey(r)) ?? 1,
      nb_lots_meme_annonce: annonceCounts.get(r.licitor_id) ?? 1,
      is_first_lot: r.lot_index === 0,
      mise_a_prix: Number(r.mise_a_prix),
    });
  }

  if (definition === "market") {
    console.log(
      `\nMarket-mode skips: ${skipped_no_dvf} (no DVF lookup), ${skipped_no_surface} (no surface).`
    );
  }
  const baseline = eng.reduce((s, r) => s + r.y, 0) / eng.length;
  console.log(`\nBaseline uncontested rate: ${fmtPct(baseline)} (${eng.filter((r) => r.y === 1).length} / ${eng.length})`);

  // Per-feature aggregations
  const byTribunal = aggBy(eng, (r) => r.tribunal_norm, baseline);
  const byType = aggBy(eng, (r) => r.property_type_norm, baseline);
  const bySurface = aggBy(eng, (r) => r.surface_bucket, baseline);
  const byMise = aggBy(eng, (r) => r.mise_bucket, baseline);
  const byMisePerSqm = aggBy(eng, (r) => r.mise_per_sqm_bucket, baseline);
  const byOcc = aggBy(eng, (r) => r.occupancy_norm ?? "?", baseline);
  const byMonth = aggBy(eng, (r) => r.month, baseline);
  const byYear = aggBy(eng, (r) => r.year, baseline);
  const byAudience = aggBy(eng, (r) => nbLotsBucket(r.nb_lots_meme_audience), baseline);
  const byAnnonce = aggBy(eng, (r) => nbLotsBucket(r.nb_lots_meme_annonce), baseline);
  const byFirstLot = aggBy(
    eng.filter((r) => r.nb_lots_meme_annonce > 1),
    (r) => (r.is_first_lot ? "premier lot" : "lot suivant"),
    baseline
  );

  // Print tables (sorted by rate desc inside printTable)
  printTable("By tribunal (top by rate, n ≥ 30)", [...byTribunal]
    .filter(([, c]) => c.n >= 30)
    .map(([k, c]) => ({ key: k, cell: c })));
  printTable("By property_type", [...byType].map(([k, c]) => ({ key: k, cell: c })));
  printTable("By surface bucket", [...bySurface].map(([k, c]) => ({ key: k, cell: c })));
  printTable("By mise_a_prix bucket", [...byMise].map(([k, c]) => ({ key: k, cell: c })));
  printTable("By mise/m² bucket", [...byMisePerSqm].map(([k, c]) => ({ key: k, cell: c })));
  printTable("By occupancy", [...byOcc].map(([k, c]) => ({ key: k, cell: c })));
  printTable("By month-of-auction", [...byMonth].map(([k, c]) => ({ key: String(k), cell: c })));
  printTable("By year", [...byYear].map(([k, c]) => ({ key: String(k), cell: c })));
  printTable("By # lots same audience", [...byAudience].map(([k, c]) => ({ key: k, cell: c })));
  printTable("By # lots same annonce", [...byAnnonce].map(([k, c]) => ({ key: k, cell: c })));
  printTable("First lot vs other (multi-lot annonces only)", [...byFirstLot].map(([k, c]) => ({ key: k, cell: c })));

  // Two-way: tribunal × property_type, top 30 cells with n ≥ 20
  const cross = new Map<string, [u: number, n: number]>();
  for (const r of eng) {
    const k = `${r.tribunal_norm}|${r.property_type_norm}`;
    const cur = cross.get(k) ?? [0, 0];
    cur[0] += r.y;
    cur[1] += 1;
    cross.set(k, cur);
  }
  const crossTop = [...cross]
    .filter(([, [, n]]) => n >= 20)
    .map(([k, [u, n]]) => ({ key: k, cell: makeCell(u, n, baseline) }))
    .sort((a, b) => b.cell.rate - a.cell.rate)
    .slice(0, 30);
  printTable("Top 30 tribunal × property_type cells (n ≥ 20)", crossTop);

  // Bottom 10 — useful to know where uncontested is rare (avoid wasting time)
  const crossBottom = [...cross]
    .filter(([, [, n]]) => n >= 50)
    .map(([k, [u, n]]) => ({ key: k, cell: makeCell(u, n, baseline) }))
    .sort((a, b) => a.cell.rate - b.cell.rate)
    .slice(0, 10);
  printTable("Bottom 10 tribunal × property_type cells (n ≥ 50)", crossBottom);

  // ── Emit JSON for the live scorer ──────────────────────────────────────
  if (emitJson) {
    const toRecord = <K extends string | number>(m: Map<K, RateCell>): Record<string, RateCell> => {
      const out: Record<string, RateCell> = {};
      for (const [k, v] of m) out[String(k)] = v;
      return out;
    };
    const artefact = {
      generated_at: new Date().toISOString(),
      definition,
      threshold_used: threshold,
      n_total: eng.length,
      baseline_rate: round4(baseline),
      by_tribunal: toRecord(byTribunal),
      by_property_type: toRecord(byType),
      by_tribunal_x_type: Object.fromEntries(
        [...cross]
          .filter(([, [, n]]) => n >= 20)
          .map(([k, [u, n]]) => [k, makeCell(u, n, baseline)])
      ),
      by_surface_bucket: toRecord(bySurface),
      by_mise_bucket: toRecord(byMise),
      by_mise_per_sqm_bucket: toRecord(byMisePerSqm),
      by_occupancy: toRecord(byOcc),
      by_month: toRecord(byMonth),
      by_audience_bucket: toRecord(byAudience),
      by_annonce_bucket: toRecord(byAnnonce),
      by_first_lot: toRecord(byFirstLot),
    };

    const defaultName =
      definition === "market"
        ? "lib/analytics/uncontested-rates-market.json"
        : `lib/analytics/uncontested-rates-t${threshold}.json`;
    const ratesPath = resolve(process.cwd(), outputPath ?? defaultName);
    writeFileSync(ratesPath, JSON.stringify(artefact, null, 2) + "\n");
    console.log(`\n✓ Wrote ${ratesPath}`);

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const reportSuffix = definition === "market" ? "market" : `t${threshold}`;
    const reportPath = resolve(
      process.cwd(),
      `scripts/analytics/output/uncontested-report-${stamp}-${reportSuffix}.json`
    );
    writeFileSync(reportPath, JSON.stringify(artefact, null, 2) + "\n");
    console.log(`✓ Wrote ${reportPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
