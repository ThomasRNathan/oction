/**
 * DVF enrichment for past_auctions.
 *
 * For each unique (city, department_code, property_type_norm) tuple we have
 * historical sales for, geocode the city → call CEREMA DVF → store the median
 * price/m² in lib/analytics/dvf-by-locality.json. Used by
 * scripts/analytics/uncontested-rates.ts --definition market to label past
 * auctions as "ended ≥40 % under DVF" (or not).
 *
 * Resumable: re-running picks up where the last run stopped (skips keys
 * already written). The Supabase `dvf_cache` table also dedupes across runs.
 *
 * Usage:
 *   pnpm tsx scripts/analytics/enrich-past-auctions-dvf.ts             # full run
 *   pnpm tsx scripts/analytics/enrich-past-auctions-dvf.ts --limit 50  # smoke test
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizePropertyType,
  type PropertyTypeBucket,
} from "../../lib/analytics/normalize-property-type";

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
const limit = flag("limit") ? Number(flag("limit")) : Infinity;
const concurrency = Number(flag("concurrency") ?? "5");

// ──────────────────────────────────────────────────────────────────────────
// Supabase
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
// Output
// ──────────────────────────────────────────────────────────────────────────
type Locality = { medianPerSqm: number; n: number; radiusUsed: number };
type LocalityIndex = Record<string, Locality>;
const OUT_PATH = resolve(process.cwd(), "lib/analytics/dvf-by-locality.json");

function loadExisting(): LocalityIndex {
  if (!existsSync(OUT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OUT_PATH, "utf8")) as LocalityIndex;
  } catch {
    return {};
  }
}

function save(index: LocalityIndex): void {
  // Sort keys for stable diffs
  const sorted: LocalityIndex = {};
  for (const k of Object.keys(index).sort()) sorted[k] = index[k];
  writeFileSync(OUT_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

function localityKey(
  city: string | null,
  dep: string | null,
  type: PropertyTypeBucket
): string {
  return `${(city ?? "").trim().toLowerCase()}|${dep ?? ""}|${type}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Geocode + DVF
// ──────────────────────────────────────────────────────────────────────────
type Geocode = { lat: number; lon: number; citycode?: string };

async function geocodeCity(city: string, dep: string | null): Promise<Geocode | null> {
  // We bias the query with the department to avoid namesakes (Saint-Étienne
  // exists in multiple départements). The api-adresse endpoint accepts
  // citycode/postcode hints but not department directly — we approximate
  // by appending the dep code as part of the free-text query.
  const q = dep ? `${city} ${dep}` : city;
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1&type=municipality`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    return {
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      citycode: f.properties?.citycode,
    };
  } catch {
    return null;
  }
}

const PROPERTY_TYPE_TO_DVF: Partial<Record<PropertyTypeBucket, string>> = {
  appartement: "Appartement",
  studio: "Appartement", // DVF has no studio bucket
  maison: "Maison",
  // parking, terrain, immeuble, local, autre → no narrow DVF type filter
  // (we'll fetch un-typed and the median is more robust on aggregate anyway)
};

interface CeremaResult {
  valeurfonc: string;
  sbati: string;
  libnatmut: string;
}

function bboxFor(lat: number, lon: number, radiusM: number): string {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    (lon - dLon).toFixed(6),
    (lat - dLat).toFixed(6),
    (lon + dLon).toFixed(6),
    (lat + dLat).toFixed(6),
  ].join(",");
}

async function fetchDvfMedian(
  geo: Geocode,
  type: PropertyTypeBucket
): Promise<{ medianPerSqm: number; n: number; radiusUsed: number } | null> {
  const dvfType = PROPERTY_TYPE_TO_DVF[type];
  const yearMin = new Date().getFullYear() - 3;

  // Build attempts in priority order: typed-tight → typed-wide → untyped-tight → untyped-wide.
  // Many past_auctions are in tiny rural communes where DVF rings are sparse,
  // so we fall through aggressively to commune + untyped.
  type Attempt = {
    params: URLSearchParams;
    radius: number; // 0 = commune-wide
    minTx: number;
  };
  const make = (radiusM: number, type: string | undefined, minTx: number): Attempt => {
    const p = new URLSearchParams({
      ordering: "-datemut",
      page_size: "200",
      anneemut_min: String(yearMin),
      in_bbox: bboxFor(geo.lat, geo.lon, radiusM),
    });
    if (type) p.set("type_local", type);
    return { params: p, radius: radiusM, minTx };
  };
  const makeCommune = (type: string | undefined, minTx: number): Attempt => {
    const p = new URLSearchParams({
      ordering: "-datemut",
      page_size: "200",
      anneemut_min: String(yearMin),
      code_insee: geo.citycode!,
    });
    if (type) p.set("type_local", type);
    return { params: p, radius: 0, minTx };
  };

  const attempts: Attempt[] = [];
  // Typed first
  if (dvfType) {
    attempts.push(make(1000, dvfType, 5));
    attempts.push(make(2000, dvfType, 5));
    if (geo.citycode) attempts.push(makeCommune(dvfType, 3));
  }
  // Untyped fallback (or only attempts when type isn't mapped)
  attempts.push(make(1000, undefined, 8));
  attempts.push(make(2000, undefined, 5));
  if (geo.citycode) attempts.push(makeCommune(undefined, 3));
  // Last resort: 5 km untyped (small rural communes)
  attempts.push(make(5000, undefined, 5));

  for (const { params, radius, minTx } of attempts) {
    try {
      const res = await fetch(
        `https://apidf-preprod.cerema.fr/dvf_opendata/mutations/?${params}`,
        { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const results = (data.results ?? []) as CeremaResult[];
      const prices: number[] = [];
      for (const r of results) {
        if (r.libnatmut !== "Vente") continue;
        const price = parseFloat(r.valeurfonc);
        const surface = parseFloat(r.sbati);
        if (!(price > 0) || !(surface > 5)) continue;
        prices.push(price / surface);
      }
      if (prices.length < minTx) continue;
      // Trim outliers (±2σ) for robustness, same as the live analyzer.
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const sd = Math.sqrt(
        prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length
      );
      const trimmed = prices.filter((v) => Math.abs(v - mean) <= 2 * sd);
      const ps = trimmed.length >= 5 ? trimmed : prices;
      ps.sort((a, b) => a - b);
      const mid = Math.floor(ps.length / 2);
      const median =
        ps.length % 2 === 0 ? (ps[mid - 1] + ps[mid]) / 2 : ps[mid];
      return { medianPerSqm: Math.round(median), n: prices.length, radiusUsed: radius };
    } catch {
      /* try next attempt */
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Concurrency primitive
// ──────────────────────────────────────────────────────────────────────────
async function pool<T, R>(
  items: T[],
  size: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: size }, worker));
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`# DVF enrichment for past_auctions`);

  // Step 1: page through past_auctions to build the unique-key set
  const pageSize = 1000;
  const uniq = new Map<string, { city: string; dep: string | null; type: PropertyTypeBucket }>();
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await db
      .from("past_auctions")
      .select("city, department_code, property_type")
      .eq("status", "sold")
      .not("mise_a_prix", "is", null)
      .not("adjudication_price", "is", null)
      .gt("mise_a_prix", 0)
      .not("city", "is", null)
      .not("surface", "is", null)
      .gt("surface", 0)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ city: string | null; department_code: string | null; property_type: string | null }>) {
      if (!r.city) continue;
      const t = normalizePropertyType(r.property_type);
      const k = localityKey(r.city, r.department_code, t);
      if (!uniq.has(k)) uniq.set(k, { city: r.city, dep: r.department_code, type: t });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Unique (city × department × type) keys: ${uniq.size}`);

  const existing = loadExisting();
  console.log(`Already cached locally: ${Object.keys(existing).length}`);

  const todo = [...uniq.entries()].filter(([k]) => !(k in existing));
  console.log(`To fetch: ${todo.length}`);
  const slice = todo.slice(0, Number.isFinite(limit) ? limit : todo.length);
  if (slice.length === 0) {
    console.log("Nothing to do.");
    return;
  }
  console.log(`Processing ${slice.length} (concurrency=${concurrency})…`);

  // Step 2: pool through, persisting every 50 completions for crash recovery
  let done = 0;
  let ok = 0;
  let failed = 0;
  const t0 = Date.now();

  await pool(slice, concurrency, async ([key, v]) => {
    try {
      const geo = await geocodeCity(v.city, v.dep);
      if (!geo) {
        failed++;
        return;
      }
      const dvf = await fetchDvfMedian(geo, v.type);
      if (!dvf) {
        failed++;
        return;
      }
      existing[key] = dvf;
      ok++;
    } catch {
      failed++;
    } finally {
      done++;
      if (done % 50 === 0 || done === slice.length) {
        save(existing);
        const elapsed = (Date.now() - t0) / 1000;
        const rate = done / elapsed;
        const eta = Math.round((slice.length - done) / Math.max(rate, 0.001));
        console.log(
          `[${done}/${slice.length}] ok=${ok} failed=${failed} ` +
            `elapsed=${elapsed.toFixed(0)}s rate=${rate.toFixed(2)}/s eta=${eta}s`
        );
      }
    }
  });

  save(existing);
  console.log(`\nDone. ok=${ok}, failed=${failed}, total cached=${Object.keys(existing).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
