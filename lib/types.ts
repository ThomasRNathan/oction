export interface PropertyData {
  id?: string;
  type?: string;
  /** "Dix parkings" → 10 (parsed from ordinal in raw type string). 1 for "Un appartement". */
  nUnits?: number;
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
  /** Lawyer's office address — kept separate from the *property* address so the
   *  analyser doesn't conflate them. */
  lawyerAddress?: string;
  warnings: string[];
}

/**
 * Parking-specific comparables block (returned in addition to / instead of
 * `verdict` when the property is a parking lot).
 *
 * `verdict` divides MAP by surface for €/m², which is meaningless for parking
 * lots that don't expose a surface. Instead, we surface the median adjudication
 * per parking unit from the same tribunal, and a ratio vs the live mise à prix.
 */
export interface ParkingComparables {
  nUnits: number;          // 10 for "Dix parkings"
  miseAPrixPerUnit: number; // miseAPrix / nUnits
  comparableCount: number;  // how many past sold parking lots in the comparison set
  medianAdjPerUnit: number; // median adjudication / n_units across comparable past lots
  meanAdjPerUnit: number;
  ratio: number;            // miseAPrixPerUnit / medianAdjPerUnit (e.g. 0.40 = MAP is 40% of typical adj)
  capRateHint: number | null; // estimated yearly rent / adjudication, if rent is rough-known
  rationale: string;        // human-readable verdict line
  scope: "tribunal" | "department" | "national"; // how comparables were filtered
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
  /** Parking-specific comparables, populated only when property type is parking/cave/box/garage. */
  parkingComparables?: ParkingComparables;
  financing?: FinancingSimulation;
  attractiveness?: AttractivenessScore;
  uncontested?: UncontestedScores;
}
