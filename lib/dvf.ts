import { DVFAnalysis, DVFTransaction } from "./types";
import { supabase } from "./supabase";

// CEREMA DVF Open Data API — works from non-datacenter IPs
const CEREMA_BASE = "https://apidf-preprod.cerema.fr/dvf_opendata/mutations/";
const CACHE_TTL_DAYS = 30;

interface CeremaResult {
  datemut: string;
  anneemut: number;
  valeurfonc: string;
  sbati: string;
  libtypbien: string;
  libnatmut: string;
}

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

// ── Supabase cache ──────────────────────────────────────────────────────────

async function readCache(
  codeInsee: string,
  propertyType: string | undefined
): Promise<DVFAnalysis | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400_000).toISOString();
  const { data } = await supabase
    .from("dvf_cache")
    .select("*")
    .eq("code_insee", codeInsee)
    .eq("property_type", propertyType ?? null)
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
    radiusUsed: 0,
    periodYears: data.period_years,
  };
}

async function writeCache(
  codeInsee: string,
  propertyType: string | undefined,
  analysis: DVFAnalysis
): Promise<void> {
  await supabase.from("dvf_cache").upsert(
    {
      code_insee: codeInsee,
      property_type: propertyType ?? null,
      median_price_sqm: analysis.medianPricePerSqm,
      mean_price_sqm: analysis.meanPricePerSqm,
      min_price_sqm: analysis.minPricePerSqm,
      max_price_sqm: analysis.maxPricePerSqm,
      tx_count: analysis.count,
      period_years: analysis.periodYears,
      transactions: analysis.transactions,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "code_insee,property_type" }
  );
}

// ── CEREMA fetch ────────────────────────────────────────────────────────────

async function fetchCerema(
  codeInsee: string,
  propertyType: string | undefined,
  yearsBack: number
): Promise<CeremaResult[]> {
  const yearMin = new Date().getFullYear() - yearsBack;
  const params = new URLSearchParams({
    code_insee: codeInsee,
    ordering: "-datemut",
    page_size: "200",
    anneemut_min: yearMin.toString(),
  });
  if (propertyType) params.set("type_local", propertyType);

  // ⚠️ No next:{revalidate} — it breaks AbortSignal
  const res = await fetch(`${CEREMA_BASE}?${params}`, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CEREMA ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
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

function buildAnalysis(transactions: DVFTransaction[]): DVFAnalysis {
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
    radiusUsed: 0,
    periodYears,
  };
}

async function fetchFromCerema(
  codeInsee: string,
  propertyType: string | undefined
): Promise<DVFAnalysis | null> {
  const attempts: [string | undefined, number][] = [
    [propertyType, 3],
    [propertyType, 5],
    [undefined, 3],
  ];
  for (const [type, years] of attempts) {
    try {
      const results = await fetchCerema(codeInsee, type, years);
      const transactions = processResults(results);
      if (transactions.length >= 3) return buildAnalysis(transactions);
    } catch {
      // timeout or network error
    }
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getDVFAnalysis(
  _lat: number,
  _lon: number,
  propertyType: string | undefined,
  codeInsee: string | undefined
): Promise<DVFAnalysis | null> {
  if (!codeInsee) return null;

  // 1. Check Supabase cache first (fast, works from any region)
  try {
    const cached = await readCache(codeInsee, propertyType);
    if (cached) return cached;
  } catch {
    // cache miss or Supabase error — fall through
  }

  // 2. Fetch from CEREMA (works from non-datacenter IPs; fails from Vercel cdg1)
  const analysis = await fetchFromCerema(codeInsee, propertyType);
  if (!analysis) return null;

  // 3. Write to Supabase cache for future requests
  writeCache(codeInsee, propertyType, analysis).catch(() => {});

  return analysis;
}
