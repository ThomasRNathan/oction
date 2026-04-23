import { DVFAnalysis, DVFTransaction } from "./types";
import { supabase } from "./supabase";

// CEREMA DVF Open Data API. Supports `in_bbox=lon_min,lat_min,lon_max,lat_max`
// for geographic filtering — we use this to query a tight ring around the
// auction's geocoded point instead of the whole commune.
const CEREMA_BASE = "https://apidf-preprod.cerema.fr/dvf_opendata/mutations/";
const CACHE_TTL_DAYS = 30;

/** Radii (meters) tried in order — tightest first. */
const RADIUS_STEPS = [500, 1000, 2000];

/** Minimum tx count required to accept a scope's result (after Vente filter). */
const MIN_TX = {
  typedRing: 5,
  typedCommune: 3,
  untypedRing: 8,
  untypedCommune: 3,
};

interface CeremaResult {
  datemut: string;
  anneemut: number;
  valeurfonc: string;
  sbati: string;
  libtypbien: string;
  libnatmut: string;
}

// ── Stats helpers ───────────────────────────────────────────────────────────

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  );
  return values.filter((v) => Math.abs(v - mean) <= 2 * stdDev);
}

// ── Geo helpers ─────────────────────────────────────────────────────────────

/** Convert a point + radius (meters) to a CEREMA `in_bbox` string. */
function radiusToBbox(lat: number, lon: number, radiusM: number): string {
  // 1° latitude ≈ 111 320 m everywhere. 1° longitude shrinks with cos(lat).
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    (lon - dLon).toFixed(6),
    (lat - dLat).toFixed(6),
    (lon + dLon).toFixed(6),
    (lat + dLat).toFixed(6),
  ].join(",");
}

/** Round to ~110 m precision so nearby listings share a cache key. */
function cacheCoord(v: number): string {
  return v.toFixed(3);
}

// ── Attempt definition & cache keying ───────────────────────────────────────

type Attempt =
  | { kind: "ring"; radiusM: number; type: string | undefined }
  | { kind: "commune"; type: string | undefined };

function attemptCacheKey(
  a: Attempt,
  lat: number | null,
  lon: number | null,
  codeInsee: string | null
): string | null {
  const t = a.type ?? "*";
  if (a.kind === "ring") {
    if (lat == null || lon == null) return null;
    return `ring:${cacheCoord(lat)}:${cacheCoord(lon)}:${a.radiusM}:${t}`;
  }
  if (!codeInsee) return null;
  return `commune:${codeInsee}:${t}`;
}

function minTxFor(a: Attempt): number {
  if (a.kind === "ring")
    return a.type ? MIN_TX.typedRing : MIN_TX.untypedRing;
  return a.type ? MIN_TX.typedCommune : MIN_TX.untypedCommune;
}

// ── Supabase cache ──────────────────────────────────────────────────────────

async function readCache(key: string): Promise<DVFAnalysis | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400_000).toISOString();
  const { data } = await supabase
    .from("dvf_cache")
    .select("*")
    .eq("cache_key", key)
    .gt("fetched_at", cutoff)
    .maybeSingle();

  if (!data) return null;

  return {
    transactions: data.transactions ?? [],
    medianPricePerSqm: data.median_price_sqm,
    meanPricePerSqm: data.mean_price_sqm,
    minPricePerSqm: data.min_price_sqm,
    maxPricePerSqm: data.max_price_sqm,
    count: data.tx_count,
    radiusUsed: data.radius_m ?? 0,
    periodYears: data.period_years,
  };
}

async function writeCache(params: {
  cacheKey: string;
  codeInsee: string;
  propertyType: string | undefined;
  centerLat: number | null;
  centerLon: number | null;
  radiusM: number | null;
  analysis: DVFAnalysis;
}): Promise<void> {
  await supabase.from("dvf_cache").upsert(
    {
      cache_key: params.cacheKey,
      code_insee: params.codeInsee,
      property_type: params.propertyType ?? null,
      center_lat: params.centerLat,
      center_lon: params.centerLon,
      radius_m: params.radiusM,
      median_price_sqm: params.analysis.medianPricePerSqm,
      mean_price_sqm: params.analysis.meanPricePerSqm,
      min_price_sqm: params.analysis.minPricePerSqm,
      max_price_sqm: params.analysis.maxPricePerSqm,
      tx_count: params.analysis.count,
      period_years: params.analysis.periodYears,
      transactions: params.analysis.transactions,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" }
  );
}

// ── CEREMA fetch ────────────────────────────────────────────────────────────

async function fetchCerema(
  query: URLSearchParams
): Promise<CeremaResult[]> {
  // ⚠️ No next:{revalidate} — it breaks AbortSignal on the Next.js fetch extension.
  const res = await fetch(`${CEREMA_BASE}?${query}`, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CEREMA ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

function buildQuery(
  opts: {
    bbox?: string;
    codeInsee?: string;
    propertyType?: string;
    yearsBack: number;
  }
): URLSearchParams {
  const yearMin = new Date().getFullYear() - opts.yearsBack;
  const params = new URLSearchParams({
    ordering: "-datemut",
    page_size: "200",
    anneemut_min: yearMin.toString(),
  });
  if (opts.bbox) params.set("in_bbox", opts.bbox);
  if (opts.codeInsee) params.set("code_insee", opts.codeInsee);
  if (opts.propertyType) params.set("type_local", opts.propertyType);
  return params;
}

function processResults(results: CeremaResult[]): DVFTransaction[] {
  return results
    .filter((r) => {
      const price = parseFloat(r.valeurfonc);
      const surface = parseFloat(r.sbati);
      return r.libnatmut === "Vente" && price > 0 && surface > 5;
    })
    .map((r) => ({
      date: r.datemut,
      price: parseFloat(r.valeurfonc),
      surface: parseFloat(r.sbati),
      pricePerSqm: parseFloat(r.valeurfonc) / parseFloat(r.sbati),
      type: r.libtypbien,
    }));
}

function buildAnalysis(
  transactions: DVFTransaction[],
  radiusUsed: number
): DVFAnalysis {
  let prices = transactions.map((t) => t.pricePerSqm);
  const raw = prices;
  prices = removeOutliers(prices);
  if (prices.length === 0) prices = raw;

  const dates = transactions.map((t) => new Date(t.date));
  const oldest = Math.min(...dates.map((d) => d.getTime()));
  const periodYears = Math.max(
    1,
    Math.round((Date.now() - oldest) / (365.25 * 24 * 60 * 60 * 1000))
  );

  return {
    transactions,
    medianPricePerSqm: Math.round(median(prices)),
    meanPricePerSqm: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    minPricePerSqm: Math.round(Math.min(...prices)),
    maxPricePerSqm: Math.round(Math.max(...prices)),
    count: transactions.length,
    radiusUsed,
    periodYears,
  };
}

/** Run one attempt (cache → live CEREMA). Returns analysis iff result is dense enough. */
async function tryAttempt(
  a: Attempt,
  lat: number | null,
  lon: number | null,
  codeInsee: string | null
): Promise<DVFAnalysis | null> {
  const key = attemptCacheKey(a, lat, lon, codeInsee);
  if (!key) return null;

  // 1. Cache first
  try {
    const cached = await readCache(key);
    if (cached) return cached;
  } catch {
    /* fall through to live fetch */
  }

  // 2. Live CEREMA. Start with a 2-year window; widen to 3 if sparse.
  for (const yearsBack of [2, 3]) {
    try {
      const query =
        a.kind === "ring" && lat != null && lon != null
          ? buildQuery({
              bbox: radiusToBbox(lat, lon, a.radiusM),
              propertyType: a.type,
              yearsBack,
            })
          : buildQuery({
              codeInsee: codeInsee ?? undefined,
              propertyType: a.type,
              yearsBack,
            });

      const results = await fetchCerema(query);
      const transactions = processResults(results);
      if (transactions.length < minTxFor(a)) continue;

      const radiusUsed = a.kind === "ring" ? a.radiusM : 0;
      const analysis = buildAnalysis(transactions, radiusUsed);

      // Cache write requires code_insee (NOT NULL column). Skip cache if absent.
      if (codeInsee) {
        writeCache({
          cacheKey: key,
          codeInsee,
          propertyType: a.type,
          centerLat: a.kind === "ring" ? lat : null,
          centerLon: a.kind === "ring" ? lon : null,
          radiusM: a.kind === "ring" ? a.radiusM : null,
          analysis,
        }).catch(() => {});
      }
      return analysis;
    } catch {
      /* timeout or network error — try next year window */
    }
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * DVF analysis for a point.
 *
 * Tries, in order:
 *   1. Tightest ring with property type (500 m → 1 km → 2 km)
 *   2. Whole commune with property type
 *   3. Same rings without type filter
 *   4. Whole commune without type filter
 *
 * Returns the first scope that has enough transactions. The scope actually
 * used is reported via `radiusUsed` (meters; 0 = commune-wide).
 */
export async function getDVFAnalysis(
  lat: number | null,
  lon: number | null,
  propertyType: string | undefined,
  codeInsee: string | undefined
): Promise<DVFAnalysis | null> {
  const haveCoords = lat != null && lon != null;
  const haveCommune = !!codeInsee;
  if (!haveCoords && !haveCommune) return null;

  const attempts: Attempt[] = [];
  // Typed ring (preferred — tight geography AND matching property type)
  if (haveCoords) {
    for (const r of RADIUS_STEPS)
      attempts.push({ kind: "ring", radiusM: r, type: propertyType });
  }
  // Typed commune
  if (haveCommune)
    attempts.push({ kind: "commune", type: propertyType });
  // Untyped fallbacks — only matter if propertyType was set; otherwise these
  // duplicate the typed attempts above (type: undefined both times).
  if (propertyType) {
    if (haveCoords) {
      for (const r of RADIUS_STEPS)
        attempts.push({ kind: "ring", radiusM: r, type: undefined });
    }
    if (haveCommune)
      attempts.push({ kind: "commune", type: undefined });
  }

  for (const a of attempts) {
    const analysis = await tryAttempt(
      a,
      lat ?? null,
      lon ?? null,
      codeInsee ?? null
    );
    if (analysis) return analysis;
  }
  return null;
}
