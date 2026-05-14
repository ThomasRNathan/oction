/**
 * Pure fee-computation for French real-estate auctions (vente sur saisie
 * immobilière / adjudication judiciaire).
 *
 * Cost components — what the adjudicataire actually pays on top of the
 * hammer price:
 *
 *   1. Émoluments d'avocat poursuivant — regulated tariff (art. A.444-191
 *      Code de commerce), proportional to the adjudication price, banded
 *      in 4 tranches (7 % / 3 % / 2 % / 1 %). TVA 20 % applies on top.
 *   2. Droits d'enregistrement (DMTO) — departmental transfer tax.
 *      Baseline 5.81 % (4.50 % droit départemental + 1.20 % taxe
 *      communale + 0.107 % frais d'assiette). Most départements raised
 *      the droit départemental to 5.00 % under the 2025 finance law,
 *      pushing the effective rate to ~6.32 %. Configurable.
 *   3. Contribution de sécurité immobilière — 0.10 % flat (formerly
 *      "salaire du conservateur des hypothèques").
 *   4. Frais préalables — set in advance by the cahier des conditions
 *      de vente (covers the poursuivant's procedural costs: publicité,
 *      bornage, etc.). Typically 1 500–5 000 €.
 *
 * Two additional figures often asked for:
 *
 *   - Seuil de surenchère : 1.10 × adjudication. Any third party can
 *     surenchère within 10 days; the adjudicataire cannot.
 *   - Caution : chèque de banque required to bid. max(10 % × mise à
 *     prix, 3 000 €). Returned to non-winning bidders.
 */

/** Tarif réglementé des avocats — tranches sur prix d'adjudication. */
export const EMOLUMENTS_TRANCHES: ReadonlyArray<readonly [upper: number, rate: number]> = [
  [6_500, 0.07],
  [17_000, 0.03],
  [60_000, 0.02],
  [Number.POSITIVE_INFINITY, 0.01],
] as const;

/** TVA française applicable aux émoluments d'avocat. */
export const TVA_RATE = 0.20;

/** Contribution de sécurité immobilière. */
export const CSI_RATE = 0.0010;

/** DMTO baseline (avant hausse 2025 du droit départemental). */
export const DEFAULT_DMTO_RATE = 0.0581;

/** Plancher de la caution (chèque de banque), en euros. */
export const CAUTION_FLOOR = 3_000;

/** Quotité minimum de la caution rapportée à la mise à prix. */
export const CAUTION_RATE = 0.10;

/** Pourcentage de surenchère obligatoire. */
export const SURENCHERE_RATE = 0.10;

export interface AuctionFeesInput {
  /** Prix d'adjudication (hammer price), en euros. */
  adjudication: number;
  /** Taux DMTO (décimal). Défaut 0.0581 = 5.81 %. */
  dmtoRate?: number;
  /** Frais préalables (forfaitaires, fixés par le cahier des conditions). */
  fraisPrealables?: number;
  /** Mise à prix — utilisée uniquement pour calculer la caution. */
  miseAPrix?: number;
}

export interface AuctionFeesBreakdown {
  // Inputs echoed back
  adjudication: number;
  dmtoRate: number;
  fraisPrealables: number;
  miseAPrix?: number;

  // Émoluments d'avocat
  emolumentsHT: number;
  emolumentsTVA: number;
  emolumentsTTC: number;

  // Taxes
  droitsEnregistrement: number;
  contributionSecurite: number;

  // Totaux
  totalFees: number;
  allIn: number;
  feeRate: number;

  // Repères secondaires
  surenchereThreshold: number;
  caution?: number;
}

/**
 * Calcule les émoluments d'avocat HT sur le prix d'adjudication suivant
 * le tarif réglementé proportionnel.
 */
export function computeEmolumentsHT(adjudication: number): number {
  if (adjudication <= 0) return 0;
  let remaining = adjudication;
  let total = 0;
  let lower = 0;

  for (const [upper, rate] of EMOLUMENTS_TRANCHES) {
    const slice = Math.min(remaining, upper - lower);
    if (slice <= 0) break;
    total += slice * rate;
    remaining -= slice;
    lower = upper;
    if (remaining <= 0) break;
  }
  return total;
}

/**
 * Calcule l'ensemble du coût d'une adjudication.
 */
export function computeFees(input: AuctionFeesInput): AuctionFeesBreakdown {
  const adjudication = Math.max(0, input.adjudication);
  const dmtoRate = input.dmtoRate ?? DEFAULT_DMTO_RATE;
  const fraisPrealables = Math.max(0, input.fraisPrealables ?? 2500);

  const emolumentsHT = computeEmolumentsHT(adjudication);
  const emolumentsTVA = emolumentsHT * TVA_RATE;
  const emolumentsTTC = emolumentsHT + emolumentsTVA;

  const droitsEnregistrement = adjudication * dmtoRate;
  const contributionSecurite = adjudication * CSI_RATE;

  const totalFees =
    emolumentsTTC + droitsEnregistrement + contributionSecurite + fraisPrealables;
  const allIn = adjudication + totalFees;
  const feeRate = adjudication > 0 ? totalFees / adjudication : 0;

  const surenchereThreshold = adjudication * (1 + SURENCHERE_RATE);
  const caution =
    typeof input.miseAPrix === "number" && input.miseAPrix > 0
      ? Math.max(input.miseAPrix * CAUTION_RATE, CAUTION_FLOOR)
      : undefined;

  return {
    adjudication,
    dmtoRate,
    fraisPrealables,
    miseAPrix: input.miseAPrix,

    emolumentsHT,
    emolumentsTVA,
    emolumentsTTC,

    droitsEnregistrement,
    contributionSecurite,

    totalFees,
    allIn,
    feeRate,

    surenchereThreshold,
    caution,
  };
}
