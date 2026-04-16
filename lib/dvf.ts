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

  const res = await fetch(`${CEREMA_BASE}?${params}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 86400 }, // cache 24h on Vercel
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

  // Try last 3 years first, then expand to 5
  for (const years of [3, 5]) {
    try {
      const results = await fetchCerema(codeInsee, propertyType, years);
      const transactions = processResults(results);
      if (transactions.length >= 3) {
        return buildAnalysis(transactions, 0);
      }
    } catch {
      continue;
    }
  }

  // Retry without type filter if too few results
  for (const years of [3, 5]) {
    try {
      const results = await fetchCerema(codeInsee, undefined, years);
      const transactions = processResults(results);
      if (transactions.length >= 3) {
        return buildAnalysis(transactions, 0);
      }
    } catch {
      continue;
    }
  }

  return null;
}
