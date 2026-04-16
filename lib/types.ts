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
}
