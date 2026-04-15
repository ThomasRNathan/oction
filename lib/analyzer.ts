import { Verdict, FinancingSimulation } from "./types";
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
