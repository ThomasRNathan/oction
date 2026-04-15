import { DVFAnalysis, DVFTransaction } from "./types";

interface DVFRawResult {
  date_mutation: string;
  valeur_fonciere: number;
  surface_reelle_bati: number;
  type_local: string;
  nature_mutation: string;
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

async function fetchDVF(
  lat: number,
  lon: number,
  dist: number,
  propertyType?: string
): Promise<DVFRawResult[]> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    dist: dist.toString(),
    nature_mutation: "Vente",
  });
  if (propertyType) {
    params.set("type_local", propertyType);
  }

  const url = `https://api.cquest.org/dvf?${params}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`DVF API error: ${response.status}`);

  const data = await response.json();
  return data.resultats || [];
}

async function fetchDVFByCommune(
  codeCommune: string,
  propertyType?: string
): Promise<DVFRawResult[]> {
  const params = new URLSearchParams({
    code_commune: codeCommune,
    nature_mutation: "Vente",
  });
  if (propertyType) {
    params.set("type_local", propertyType);
  }

  const url = `https://api.cquest.org/dvf?${params}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`DVF API error: ${response.status}`);

  const data = await response.json();
  return data.resultats || [];
}

function processTransactions(
  results: DVFRawResult[],
  yearsBack: number
): DVFTransaction[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return results
    .filter(
      (r) =>
        r.valeur_fonciere > 0 &&
        r.surface_reelle_bati > 0 &&
        r.date_mutation >= cutoffStr
    )
    .map((r) => ({
      date: r.date_mutation,
      price: r.valeur_fonciere,
      surface: r.surface_reelle_bati,
      pricePerSqm: r.valeur_fonciere / r.surface_reelle_bati,
      type: r.type_local,
    }));
}

export async function getDVFAnalysis(
  lat: number,
  lon: number,
  propertyType?: string,
  codeCommune?: string
): Promise<DVFAnalysis | null> {
  const radii = [500, 1000, 1500];

  for (const radius of radii) {
    try {
      const results = await fetchDVF(lat, lon, radius, propertyType);
      let transactions = processTransactions(results, 2);

      // Expand to 5 years if too few
      if (transactions.length < 5) {
        transactions = processTransactions(results, 5);
      }

      if (transactions.length >= 3) {
        return buildAnalysis(transactions, radius);
      }
    } catch {
      continue;
    }
  }

  // Fallback: commune code
  if (codeCommune) {
    try {
      const results = await fetchDVFByCommune(codeCommune, propertyType);
      let transactions = processTransactions(results, 2);
      if (transactions.length < 5) {
        transactions = processTransactions(results, 5);
      }
      if (transactions.length >= 1) {
        return buildAnalysis(transactions, 0);
      }
    } catch {
      // DVF completely unavailable
    }
  }

  return null;
}

function buildAnalysis(
  transactions: DVFTransaction[],
  radiusUsed: number
): DVFAnalysis {
  let prices = transactions.map((t) => t.pricePerSqm);
  prices = removeOutliers(prices);

  if (prices.length === 0) {
    prices = transactions.map((t) => t.pricePerSqm);
  }

  const dates = transactions.map((t) => new Date(t.date));
  const oldest = Math.min(...dates.map((d) => d.getTime()));
  const periodYears = Math.max(
    1,
    Math.round(
      (Date.now() - oldest) / (365.25 * 24 * 60 * 60 * 1000)
    )
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
