/**
 * Uncontested-auction probability scorer (multi-mode).
 *
 * Three definitions of "is this a good deal" are supported, each backed by its
 * own pre-baked rate-table JSON (regenerated quarterly via
 *   scripts/analytics/uncontested-rates.ts):
 *
 *   exact  — adjudication = mise à prix         → uncontested-rates-t0.json
 *   soft   — adjudication ≤ mise à prix × 1.05  → uncontested-rates-t0.05.json
 *   market — adjudication ≤ 0.6 × DVF/m²        → uncontested-rates-market.json
 *
 * Scoring approach: multiplicative lifts over the table's baseline.
 *
 *   p₀ = baseline_rate
 *   p  = p₀ · ∏ lift_i     (lifts capped to [1/3, 3] per feature)
 *   clamp to [0.01, 0.95]
 *
 * Each lift is a *cell rate / baseline rate* read from the active table. We
 * require a minimum bucket size (n ≥ 30) to use a lift; smaller buckets fall
 * back to lift=1 (no contribution).
 *
 * Market mode additionally:
 *   - Requires `dvfMedianPerSqm`, `property.miseAPrix`, `property.surface`.
 *     Any missing → return null (UI greys the tab).
 *   - Applies a hard gate: if floor/m² > 0.6 × DVF/m², adjudication can't go
 *     below the floor by definition (the floor is a reserve at French
 *     auctions), so deep discount is impossible regardless of features.
 *   - Prepends a "Prix plancher : -X % sous DVF" detail row so the user sees
 *     the headline number alongside the feature-driven probability.
 *
 * The function returns the top-3 contributing factors as `details`.
 */
import type { PropertyData, UncontestedDetail, UncontestedScore } from "../types";
import { normalizeTribunal } from "./normalize-tribunal";
import {
  normalizePropertyType,
  type PropertyTypeBucket,
} from "./normalize-property-type";
import { normalizeOccupancy } from "./normalize-occupancy";
import t0Json from "./uncontested-rates-t0.json";
import t05Json from "./uncontested-rates-t0.05.json";
import marketJson from "./uncontested-rates-market.json";

// ──────────────────────────────────────────────────────────────────────────
// Types for the JSON artefact
// ──────────────────────────────────────────────────────────────────────────
type RateCell = {
  n: number;
  n_uncontested: number;
  rate: number;
  lift: number;
  ci_low: number;
  ci_high: number;
};
type RatesArtefact = {
  generated_at: string;
  definition?: string;
  threshold_used: number;
  n_total: number;
  baseline_rate: number;
  by_tribunal: Record<string, RateCell>;
  by_property_type: Record<string, RateCell>;
  by_tribunal_x_type: Record<string, RateCell>;
  by_surface_bucket: Record<string, RateCell>;
  by_mise_bucket: Record<string, RateCell>;
  by_mise_per_sqm_bucket: Record<string, RateCell>;
  by_occupancy: Record<string, RateCell>;
  by_month: Record<string, RateCell>;
  by_audience_bucket: Record<string, RateCell>;
};

const t0 = t0Json as RatesArtefact;
const t05 = t05Json as RatesArtefact;
const market = marketJson as RatesArtefact;

export type UncontestedMode = "exact" | "soft" | "market";

function tableFor(mode: UncontestedMode): RatesArtefact {
  switch (mode) {
    case "exact":
      return t0;
    case "soft":
      return t05;
    case "market":
      return market;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Bucket helpers — must match scripts/analytics/uncontested-rates.ts
// ──────────────────────────────────────────────────────────────────────────
function surfaceBucket(s: number | null | undefined): string {
  if (s == null) return "?";
  if (s < 20) return "<20 m²";
  if (s < 40) return "20–40 m²";
  if (s < 60) return "40–60 m²";
  if (s < 100) return "60–100 m²";
  if (s < 150) return "100–150 m²";
  return ">150 m²";
}
function miseBucket(m: number): string {
  if (m < 50_000) return "<50k €";
  if (m < 100_000) return "50–100k €";
  if (m < 200_000) return "100–200k €";
  if (m < 500_000) return "200–500k €";
  return ">500k €";
}
function misePerSqmBucket(m: number, s: number | null | undefined): string {
  if (s == null || s <= 0) return "?";
  const pps = m / s;
  if (pps < 1000) return "<1k €/m²";
  if (pps < 2000) return "1–2k €/m²";
  if (pps < 4000) return "2–4k €/m²";
  if (pps < 7000) return "4–7k €/m²";
  return ">7k €/m²";
}

// ──────────────────────────────────────────────────────────────────────────
// Lift utilities
// ──────────────────────────────────────────────────────────────────────────
const MIN_N = 30; // min bucket sample size to trust the lift
const LIFT_FLOOR = 1 / 3; // cap individual contribution to ×0.33
const LIFT_CEIL = 3; // cap individual contribution to ×3.0

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function cappedLift(cell: RateCell | undefined): number {
  if (!cell || cell.n < MIN_N) return 1;
  return clamp(cell.lift, LIFT_FLOOR, LIFT_CEIL);
}

function fmtLiftPct(lift: number): string {
  if (lift > 1) return `+${Math.round((lift - 1) * 100)}%`;
  return `${Math.round((lift - 1) * 100)}%`;
}

function impactOf(lift: number): "positive" | "negative" | "neutral" {
  if (lift >= 1.05) return "positive";
  if (lift <= 0.95) return "negative";
  return "neutral";
}

// ──────────────────────────────────────────────────────────────────────────
// Pretty French names for buckets shown in the UI
// ──────────────────────────────────────────────────────────────────────────
const TYPE_LABELS_FR: Record<PropertyTypeBucket, string> = {
  appartement: "appartement",
  studio: "studio",
  maison: "maison",
  immeuble: "immeuble",
  parking: "parking",
  terrain: "terrain",
  local: "local",
  autre: "bien atypique",
};

// ──────────────────────────────────────────────────────────────────────────
// Per-mode caption — short human description of the active definition
// ──────────────────────────────────────────────────────────────────────────
function captionFor(mode: UncontestedMode): string {
  switch (mode) {
    case "exact":
      return "adjudication = mise à prix";
    case "soft":
      return "adjudication ≤ mise à prix +5 %";
    case "market":
      return "adjudication ≥ 40 % sous DVF";
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Per-mode label & colour bands
// ──────────────────────────────────────────────────────────────────────────
function bandsFor(mode: UncontestedMode, p: number): { label: string; color: string } {
  if (mode === "market") {
    // Calibrated against an empirical baseline of ~60 % (French saisie-immobilière
    // sets MAP deliberately below market, so most uncontested wins do land ≥40 %
    // under DVF). Bands are spread around that baseline.
    if (p >= 0.78) return { label: "Très probablement ≥40 % sous marché", color: "#22c55e" };
    if (p >= 0.62) return { label: "Probable ≥40 % sous marché", color: "#3b82f6" };
    if (p >= 0.45) return { label: "Possible ≥40 % sous marché", color: "#f59e0b" };
    if (p >= 0.25) return { label: "Décote profonde improbable", color: "#f97316" };
    return { label: "Décote profonde quasi-exclue", color: "#ef4444" };
  }
  // exact / soft — same wording
  if (p >= 0.30) return { label: "Très probablement sans surenchère", color: "#22c55e" };
  if (p >= 0.18) return { label: "Probable sans surenchère", color: "#3b82f6" };
  if (p >= 0.10) return { label: "Possible sans surenchère", color: "#f59e0b" };
  if (p >= 0.05) return { label: "Surenchère probable", color: "#f97316" };
  return { label: "Surenchère quasi-certaine", color: "#ef4444" };
}

// ──────────────────────────────────────────────────────────────────────────
// Core scorer (mode-agnostic feature lifts)
// ──────────────────────────────────────────────────────────────────────────
function scoreFromTable(
  property: PropertyData,
  rates: RatesArtefact
): { probability: number; contributions: Array<{ detail: UncontestedDetail; lift: number }> } {
  const baseline = rates.baseline_rate;
  const map = property.miseAPrix;
  const surface = property.surface;

  const contributions: Array<{ detail: UncontestedDetail; lift: number }> = [];

  // Tribunal
  const tribunalNorm = normalizeTribunal(property.tribunal);
  if (tribunalNorm) {
    const cell = rates.by_tribunal[tribunalNorm];
    const lift = cappedLift(cell);
    if (lift !== 1) {
      contributions.push({
        detail: {
          label: tribunalNorm,
          value: `${fmtLiftPct(lift)} vs base`,
          lift,
          impact: impactOf(lift),
        },
        lift,
      });
    }
  }

  // Property type
  const typeBucket = normalizePropertyType(property.type);
  const typeCell = rates.by_property_type[typeBucket];
  const typeLift = cappedLift(typeCell);
  if (typeLift !== 1) {
    contributions.push({
      detail: {
        label: `Type : ${TYPE_LABELS_FR[typeBucket]}`,
        value: `${fmtLiftPct(typeLift)} vs base`,
        lift: typeLift,
        impact: impactOf(typeLift),
      },
      lift: typeLift,
    });
  }

  // Tribunal × type joint cell — replaces the marginals when it diverges meaningfully
  if (tribunalNorm) {
    const xKey = `${tribunalNorm}|${typeBucket}`;
    const xCell = rates.by_tribunal_x_type[xKey];
    if (xCell && xCell.n >= 50) {
      const joint = cappedLift(xCell);
      const product =
        contributions.find((c) => c.detail.label === tribunalNorm)?.lift ?? 1;
      const productType =
        contributions.find((c) => c.detail.label.startsWith("Type :"))?.lift ?? 1;
      const expected = product * productType;
      if (Math.abs(joint - expected) > 0.3) {
        contributions.splice(0, contributions.length, {
          detail: {
            label: `${tribunalNorm} × ${TYPE_LABELS_FR[typeBucket]}`,
            value: `${fmtLiftPct(joint)} vs base`,
            lift: joint,
            impact: impactOf(joint),
          },
          lift: joint,
        });
      }
    }
  }

  // Mise à prix bucket
  if (map != null && map > 0) {
    const cell = rates.by_mise_bucket[miseBucket(map)];
    const lift = cappedLift(cell);
    if (lift !== 1) {
      contributions.push({
        detail: {
          label: `Mise à prix : ${miseBucket(map)}`,
          value: `${fmtLiftPct(lift)} vs base`,
          lift,
          impact: impactOf(lift),
        },
        lift,
      });
    }
  }

  // Mise/m² bucket
  if (map != null && map > 0) {
    const cell = rates.by_mise_per_sqm_bucket[misePerSqmBucket(map, surface)];
    const lift = cappedLift(cell);
    if (lift !== 1) {
      contributions.push({
        detail: {
          label: `Prix/m² : ${misePerSqmBucket(map, surface)}`,
          value: `${fmtLiftPct(lift)} vs base`,
          lift,
          impact: impactOf(lift),
        },
        lift,
      });
    }
  }

  // Surface
  if (surface != null) {
    const cell = rates.by_surface_bucket[surfaceBucket(surface)];
    const lift = cappedLift(cell);
    if (lift !== 1) {
      contributions.push({
        detail: {
          label: `Surface : ${surfaceBucket(surface)}`,
          value: `${fmtLiftPct(lift)} vs base`,
          lift,
          impact: impactOf(lift),
        },
        lift,
      });
    }
  }

  // Occupancy
  const occ = normalizeOccupancy(property.occupancy);
  if (occ) {
    const cell = rates.by_occupancy[occ];
    const lift = cappedLift(cell);
    if (lift !== 1) {
      contributions.push({
        detail: {
          label: `Occupation : ${occ}`,
          value: `${fmtLiftPct(lift)} vs base`,
          lift,
          impact: impactOf(lift),
        },
        lift,
      });
    }
  }

  // Month-of-auction
  const month = parseFrenchMonth(property.auctionDate);
  if (month != null) {
    const cell = rates.by_month[String(month)];
    const lift = cappedLift(cell);
    if (lift !== 1) {
      contributions.push({
        detail: {
          label: `Mois ${MONTH_NAMES_FR[month - 1]}`,
          value: `${fmtLiftPct(lift)} vs base`,
          lift,
          impact: impactOf(lift),
        },
        lift,
      });
    }
  }

  // Combine — multiplicative
  let probability = baseline;
  for (const c of contributions) probability *= c.lift;
  probability = clamp(probability, 0.01, 0.95);

  return { probability, contributions };
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────
export function computeUncontestedProbability(
  property: PropertyData,
  mode: UncontestedMode = "soft",
  dvfMedianPerSqm?: number
): UncontestedScore | null {
  const rates = tableFor(mode);

  // Market mode — needs DVF + a known floor/m² before scoring is meaningful.
  if (mode === "market") {
    if (rates.n_total === 0) return null; // table not yet baked
    if (dvfMedianPerSqm == null || dvfMedianPerSqm <= 0) return null;
    if (property.miseAPrix == null || property.miseAPrix <= 0) return null;
    if (property.surface == null || property.surface <= 0) return null;

    const floorPerSqm = property.miseAPrix / property.surface;
    const discount = 1 - floorPerSqm / dvfMedianPerSqm;
    const discountPct = Math.round(discount * 100);

    // Hard gate: at French saisie-immobilière, adjudication never goes below
    // the floor. So if floor/m² > 0.6 × DVF/m² (i.e. discount < 40 %), a deep
    // discount is mathematically impossible regardless of feature lifts.
    if (discount < 0.4) {
      return {
        probability: 0.01,
        baseline: rates.baseline_rate,
        label: "Plancher trop élevé : décote ≥40 % impossible",
        color: "#ef4444",
        details: [
          {
            label: "Prix plancher",
            value: `${discountPct >= 0 ? "-" : "+"}${Math.abs(discountPct)}% vs DVF`,
            lift: 1,
            impact: "negative",
          },
        ],
        threshold: 0.4,
        sampleSize: rates.n_total,
        mode: "market",
        caption: captionFor("market"),
      };
    }

    // Floor already < 0.6 × DVF — score from features and prepend the headline detail.
    const { probability, contributions } = scoreFromTable(property, rates);
    const topDetails = contributions
      .slice()
      .sort((a, b) => Math.abs(b.lift - 1) - Math.abs(a.lift - 1))
      .slice(0, 3)
      .map((c) => c.detail);
    const headline: UncontestedDetail = {
      label: "Prix plancher",
      value: `-${discountPct}% vs DVF`,
      lift: 1,
      impact: "positive",
    };
    const { label, color } = bandsFor("market", probability);
    return {
      probability,
      baseline: rates.baseline_rate,
      label,
      color,
      details: [headline, ...topDetails].slice(0, 4),
      threshold: 0.4,
      sampleSize: rates.n_total,
      mode: "market",
      caption: captionFor("market"),
    };
  }

  // Threshold modes (exact, soft) — straightforward feature scoring.
  const { probability, contributions } = scoreFromTable(property, rates);
  const topDetails = contributions
    .slice()
    .sort((a, b) => Math.abs(b.lift - 1) - Math.abs(a.lift - 1))
    .slice(0, 3)
    .map((c) => c.detail);
  const { label, color } = bandsFor(mode, probability);

  return {
    probability,
    baseline: rates.baseline_rate,
    label,
    color,
    details: topDetails,
    threshold: rates.threshold_used,
    sampleSize: rates.n_total,
    mode,
    caption: captionFor(mode),
  };
}

/** Compute scores for all three modes in one pass. Used by /api/analyze. */
export function computeAllScores(
  property: PropertyData,
  dvfMedianPerSqm?: number
): {
  exact: UncontestedScore;
  soft: UncontestedScore;
  market: UncontestedScore | null;
} {
  return {
    // exact and soft never return null — feature scoring works without DVF.
    exact: computeUncontestedProbability(property, "exact")!,
    soft: computeUncontestedProbability(property, "soft")!,
    market: computeUncontestedProbability(property, "market", dvfMedianPerSqm),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Date helpers — auctionDate on PropertyData is free-text French
// ──────────────────────────────────────────────────────────────────────────
const MONTH_NAMES_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

const MONTHS: Record<string, number> = {
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11,
  "décembre": 12, decembre: 12,
};

function parseFrenchMonth(s: string | undefined | null): number | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  for (const [name, num] of Object.entries(MONTHS)) {
    if (lower.includes(name)) return num;
  }
  // ISO dates "2026-01-15"
  const iso = /^(\d{4})-(\d{2})-/.exec(s);
  if (iso) {
    const m = parseInt(iso[2], 10);
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}
