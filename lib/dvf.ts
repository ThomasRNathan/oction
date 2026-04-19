import { DVFAnalysis, DVFTransaction } from "./types";

// CEREMA DVF Open Data API — works with INSEE commune code
const CEREMA_BASE = "https://apidf-preprod.cerema.fr/dvf_opendata/mutations/";

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

  // ⚠️ Do NOT add next:{revalidate} here — it wraps fetch and breaks AbortSignal
  const res = await fetch(`${CEREMA_BASE}?${params}`, {
    signal: AbortSignal.timeout(5000),
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`CEREMA DVF ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

function processResults(results: CeremaResult[]): DVFTransaction[] {
  return results
    .filter((r) => {
      const price = parseFloat(r.valeurfonc);
      const surface = parseFloat(r.sbati);
      return (
        r.libnatmut === "Vente" &&
        price > 0 &&
        surface > 5 // ignore parking/cave-only lots
      );
    })
    .map((r) => {
      const price = parseFloat(r.valeurfonc);
      const surface = parseFloat(r.sbati);
      return {
        date: r.datemut,
        price,
        surface,
        pricePerSqm: price / surface,
        type: r.libtypbien,
      };
    });
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
    meanPricePerSqm: Math.round(
      prices.reduce((a, b) => a + b, 0) / prices.length
    ),
    minPricePerSqm: Math.round(Math.min(...prices)),
    maxPricePerSqm: Math.round(Math.max(...prices)),
    count: transactions.length,
    radiusUsed,
    periodYears,
  };
}

export async function getDVFAnalysis(
  _lat: number,
  _lon: number,
  propertyType: string | undefined,
  codeInsee: string | undefined
): Promise<DVFAnalysis | null> {
  if (!codeInsee) return null;

  // Single pass: typed 3yr → typed 5yr → untyped 3yr (each with 5s abort)
  const attempts: [string | undefined, number][] = [
    [propertyType, 3],
    [propertyType, 5],
    [undefined, 3],
  ];

  for (const [type, years] of attempts) {
    try {
      const results = await fetchCerema(codeInsee, type, years);
      const transactions = processResults(results);
      if (transactions.length >= 3) {
        return buildAnalysis(transactions, 0);
      }
    } catch {
      // timeout or network error — try next variant
    }
  }

  return null;
}
