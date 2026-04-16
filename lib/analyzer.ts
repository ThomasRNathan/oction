import { Verdict, FinancingSimulation, AttractivenessScore, AttractivenessDetail, PropertyData } from "./types";
import { DEFAULT_FINANCING } from "./constants";

export function computeVerdict(
  miseAPrix: number,
  surface: number,
  marketMedianPricePerSqm: number
): Verdict {
  const auctionPricePerSqm = Math.round(miseAPrix / surface);
  const discountPercent = Math.round(
    ((marketMedianPricePerSqm - auctionPricePerSqm) / marketMedianPricePerSqm) * 100
  );

  let rating: Verdict["rating"];
  let label: string;
  let color: string;

  if (discountPercent >= 40) {
    rating = "excellent";
    label = "Excellente affaire";
    color = "#22c55e";
  } else if (discountPercent >= 20) {
    rating = "good";
    label = "Bonne affaire";
    color = "#3b82f6";
  } else if (discountPercent >= 0) {
    rating = "fair";
    label = "Prix correct";
    color = "#f59e0b";
  } else {
    rating = "overpriced";
    label = "Au-dessus du marché";
    color = "#ef4444";
  }

  return {
    rating,
    auctionPricePerSqm,
    marketPricePerSqm: marketMedianPricePerSqm,
    discountPercent,
    label,
    color,
  };
}

export function computeFinancing(
  totalAmount: number,
  ratePercent: number = DEFAULT_FINANCING.rate,
  durationYears: number = DEFAULT_FINANCING.durationYears,
  includeNotaryFees: boolean = true
): FinancingSimulation {
  const notaryFees = includeNotaryFees
    ? totalAmount * (DEFAULT_FINANCING.notaryFeesPercent / 100)
    : 0;
  const loanAmount = totalAmount + notaryFees;
  const monthlyRate = ratePercent / 100 / 12;
  const numberOfPayments = durationYears * 12;

  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = loanAmount / numberOfPayments;
  } else {
    monthlyPayment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  }

  const totalCost = monthlyPayment * numberOfPayments;
  const totalInterest = totalCost - loanAmount;

  return {
    loanAmount: Math.round(loanAmount),
    rate: ratePercent,
    durationYears,
    monthlyPayment: Math.round(monthlyPayment),
    totalCost: Math.round(totalCost),
    totalInterest: Math.round(totalInterest),
  };
}

const MONTHS_FR: Record<string, number> = {
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5,
  juin: 6, juillet: 7, "août": 8, aout: 8, septembre: 9,
  octobre: 10, novembre: 11, "décembre": 12, decembre: 12,
};

/** High-demand cities for judicial auctions */
const HIGH_DEMAND_CITIES = ["paris", "lyon", "marseille", "bordeaux", "nice", "nantes", "toulouse", "rennes", "strasbourg", "montpellier", "lille"];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function computeAttractiveness(property: PropertyData): AttractivenessScore {
  const details: AttractivenessDetail[] = [];
  let score = 5; // neutral baseline

  // 1. Visit date exists?
  if (!property.visitDate) {
    score -= 2.5;
    details.push({ label: "Pas de date de visite", value: "Souvent oublié par l'avocat", impact: "negative" });
  } else {
    // Extract month from visitDate
    const lower = property.visitDate.toLowerCase();
    const monthEntry = Object.entries(MONTHS_FR).find(([m]) => lower.includes(m));
    const month = monthEntry ? monthEntry[1] : null;

    if (month === 8) {
      score -= 1;
      details.push({ label: "Visite en août", value: "Moins de visiteurs en été", impact: "negative" });
    } else if (month !== null) {
      // Check time slot
      const timeMatch = property.visitDate.match(/(\d{1,2})[hH:](\d{2})?/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        if (hour >= 10 && hour <= 16) {
          score += 0.5;
          details.push({ label: "Visite en journée", value: property.visitDate, impact: "positive" });
        } else {
          details.push({ label: "Visite hors horaires", value: property.visitDate, impact: "neutral" });
        }
      } else {
        details.push({ label: "Date de visite", value: property.visitDate, impact: "positive" });
      }
    }
  }

  // 2. City / tribunal demand
  const tribunalCity = (property.tribunal || property.city || "").toLowerCase();
  if (tribunalCity.includes("paris")) {
    score += 2;
    details.push({ label: "Tribunal de Paris", value: "Très forte demande", impact: "positive" });
  } else if (HIGH_DEMAND_CITIES.some(c => tribunalCity.includes(c))) {
    score += 1;
    details.push({ label: "Grande ville", value: "Bonne demande", impact: "positive" });
  } else {
    score -= 0.5;
    details.push({ label: "Ville secondaire", value: "Demande modérée", impact: "neutral" });
  }

  // 3. Mise à prix accessibility
  if (property.miseAPrix) {
    const map = property.miseAPrix;
    if (map < 80000) {
      score += 1.5;
      details.push({ label: "Mise à prix très basse", value: `${map.toLocaleString("fr-FR")} €`, impact: "positive" });
    } else if (map < 200000) {
      score += 1;
      details.push({ label: "Mise à prix accessible", value: `${map.toLocaleString("fr-FR")} €`, impact: "positive" });
    } else if (map < 500000) {
      details.push({ label: "Mise à prix modérée", value: `${map.toLocaleString("fr-FR")} €`, impact: "neutral" });
    } else {
      score -= 1;
      details.push({ label: "Mise à prix élevée", value: `${map.toLocaleString("fr-FR")} €`, impact: "negative" });
    }
  }

  // 4. Property type
  const type = (property.type || "").toLowerCase();
  if (type === "appartement") {
    score += 1;
    details.push({ label: "Appartement", value: "Bien très convoité", impact: "positive" });
  } else if (type === "maison") {
    score += 0.5;
    details.push({ label: "Maison", value: "Bien recherché", impact: "positive" });
  } else if (type === "parking") {
    score += 0.5;
    details.push({ label: "Parking", value: "Achat simple", impact: "positive" });
  } else if (type === "terrain" || type === "local") {
    score -= 1;
    details.push({ label: type.charAt(0).toUpperCase() + type.slice(1), value: "Moins convoité", impact: "negative" });
  } else if (type === "immeuble") {
    score -= 1.5;
    details.push({ label: "Immeuble", value: "Capital important requis", impact: "negative" });
  }

  // 5. Surface
  if (property.surface) {
    if (property.surface < 20) {
      score -= 1;
      details.push({ label: "Très petite surface", value: `${property.surface} m²`, impact: "negative" });
    } else if (property.surface < 40) {
      score -= 0.5;
      details.push({ label: "Studio / petite surface", value: `${property.surface} m²`, impact: "neutral" });
    } else if (property.surface <= 100) {
      score += 0.5;
      details.push({ label: "Surface standard", value: `${property.surface} m²`, impact: "positive" });
    } else {
      details.push({ label: "Grande surface", value: `${property.surface} m²`, impact: "neutral" });
    }
  }

  // 6. Occupancy
  if (property.occupancy) {
    if (/libre/i.test(property.occupancy)) {
      score += 1.5;
      details.push({ label: "Bien libre", value: "Prise de possession immédiate", impact: "positive" });
    } else if (/occup/i.test(property.occupancy)) {
      score -= 1.5;
      details.push({ label: "Bien occupé", value: "Complexité supplémentaire", impact: "negative" });
    }
  }

  const finalScore = clamp(Math.round(score * 10) / 10, 0, 10);

  let label: string;
  let color: string;
  if (finalScore >= 8) { label = "Très prisé"; color = "#22c55e"; }
  else if (finalScore >= 6) { label = "Bien convoité"; color = "#3b82f6"; }
  else if (finalScore >= 4) { label = "Demande modérée"; color = "#f59e0b"; }
  else if (finalScore >= 2) { label = "Peu convoité"; color = "#f97316"; }
  else { label = "Très peu convoité"; color = "#ef4444"; }

  return { score: finalScore, label, color, details };
}
