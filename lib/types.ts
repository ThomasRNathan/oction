export interface PropertyData {
  id?: string;
  type?: string;
  address?: string;
  city?: string;
  arrondissement?: number;
  surface?: number;
  rooms?: string;
  floor?: string;
  occupancy?: string;
  description?: string;
  miseAPrix?: number;
  auctionDate?: string;
  tribunal?: string;
  visitDate?: string;
  lawyer?: string;
  lawyerPhone?: string;
  warnings: string[];
}

export interface GeocodingResult {
  lat: number;
  lon: number;
  score: number;
  label: string;
  citycode?: string; // INSEE commune code (e.g. "75116")
}

export interface AttractivenessDetail {
  label: string;
  value: string;
  impact: "positive" | "negative" | "neutral";
}

export interface AttractivenessScore {
  score: number; // 0–10
  label: string; // "Très prisé", "Peu convoité", etc.
  color: string;
  details: AttractivenessDetail[];
}

/** One reason contributing to the uncontested probability, with its multiplicative lift. */
export interface UncontestedDetail {
  label: string;       // "Tribunal de Versailles"
  value: string;       // "+67% vs base"
  lift: number;        // 1.67 (multiplier applied to baseline)
  impact: "positive" | "negative" | "neutral"; // positive when lift > 1.05
}

/**
 * Probability that the auction goes uncontested (adjudication ≈ mise à prix),
 * i.e. you win at the floor price because nobody outbids you.
 *
 * Computed by `computeUncontestedProbability()` from the precomputed rate
 * tables in lib/analytics/uncontested-rates-{t0,t0.05,market}.json
 * (regenerated quarterly via scripts/analytics/uncontested-rates.ts).
 */
export interface UncontestedScore {
  probability: number; // 0..1
  baseline: number;    // 0..1, for context (overall uncontested rate)
  label: string;       // "Très probable", "Improbable", etc.
  color: string;
  details: UncontestedDetail[];
  threshold: number;   // 0..1, e.g. 0.01 = "within +1% of mise à prix"
  sampleSize: number;  // n_total of the rate tables
  mode: "exact" | "soft" | "market"; // which artefact this score came from
  caption: string;     // short human caption for the active definition
}

/**
 * Three views of "is this a good deal" surfaced as a tab control in the UI:
 *  - exact:  adjudication = mise à prix (threshold 0)
 *  - soft:   adjudication ≤ mise à prix × 1.05 (threshold 0.05)  — default
 *  - market: adjudication ≥ 40 % below DVF market price/m²
 *            null when the live lot lacks DVF data, surface or mise à prix.
 */
export interface UncontestedScores {
  exact: UncontestedScore;
  soft: UncontestedScore;
  market: UncontestedScore | null;
}

export interface DVFTransaction {
  date: string;
  price: number;
  surface: number;
  pricePerSqm: number;
  type: string;
}

export interface DVFAnalysis {
  transactions: DVFTransaction[];
  medianPricePerSqm: number;
  meanPricePerSqm: number;
  minPricePerSqm: number;
  maxPricePerSqm: number;
  count: number;
  radiusUsed: number;
  periodYears: number;
}

export interface Verdict {
  rating: "excellent" | "good" | "fair" | "overpriced";
  auctionPricePerSqm: number;
  marketPricePerSqm: number;
  discountPercent: number;
  label: string;
  color: string;
}

export interface FinancingSimulation {
  loanAmount: number;
  rate: number;
  durationYears: number;
  monthlyPayment: number;
  totalCost: number;
  totalInterest: number;
}

export interface AnalysisResult {
  property: PropertyData;
  geocoding?: GeocodingResult;
  dvf?: DVFAnalysis;
  verdict?: Verdict;
  financing?: FinancingSimulation;
  attractiveness?: AttractivenessScore;
  uncontested?: UncontestedScores;
}
