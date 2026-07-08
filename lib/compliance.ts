/**
 * Copy-compliance guardrails for the public marketing surface.
 *
 * This operator markets sourcing of French judicial real-estate auctions to
 * *investisseurs avertis*. French financial-promotion rules (and plain honesty)
 * forbid a number of claims. The constants and checker here are the single
 * source of truth — marketing components import the disclaimer from here, and
 * `scripts/check-compliance.ts` scans the rendered copy in CI.
 *
 * Hard rules (enforced by BANNED_PATTERNS):
 *   - NO guaranteed returns / capital ("rendement garanti", "capital garanti").
 *   - NO "risque faible".
 *   - NO "garanti par la pierre".
 *   - NO "éligible 150-0 B ter" (tax-scheme eligibility claim).
 * Returns may ONLY be expressed as the approved phrasing below.
 */

/** The only compliant way to express a return target anywhere on the site. */
export const TRI_PHRASING =
  "objectif de TRI, non garanti, capital à risque" as const;

/** Mandatory disclaimer — rendered verbatim in the footer and on the investor page. */
export const DISCLAIMER =
  "Communication à caractère informatif, réservée à des investisseurs avertis. " +
  "Capital à risque, investissement non liquide. Ne constitue ni une offre au " +
  "public de titres financiers, ni un conseil en investissement.";

/** Short attestation shown before the investor contact form. */
export const AVERTI_ATTESTATION =
  "Je certifie être un investisseur averti et avoir conscience que tout " +
  "investissement présente un risque de perte en capital.";

interface BannedPattern {
  /** Case-insensitive matcher. */
  re: RegExp;
  /** Human label for the violation report. */
  label: string;
}

/**
 * Forbidden claims. Patterns are deliberately broad (accents optional, common
 * variants covered) so a near-miss like "rendements garantis" is still caught.
 */
export const BANNED_PATTERNS: readonly BannedPattern[] = [
  { re: /rendements?\s+garantis?/i, label: "rendement garanti" },
  { re: /capital\s+garanti/i, label: "capital garanti" },
  { re: /gains?\s+garantis?/i, label: "gain garanti" },
  { re: /garantie?\s+de\s+(rendement|capital)/i, label: "garantie de rendement/capital" },
  { re: /garanti\s+par\s+la\s+pierre/i, label: "garanti par la pierre" },
  { re: /risque\s+faible/i, label: "risque faible" },
  { re: /sans\s+risque/i, label: "sans risque" },
  { re: /\b[ée]ligible\s+150-?0\s*B\s*ter/i, label: "éligible 150-0 B ter" },
  { re: /\b150-?0\s*B\s*ter/i, label: "150-0 B ter" },
];

export interface ComplianceViolation {
  label: string;
  match: string;
}

/** Returns every banned phrase found in `text` (empty array = compliant). */
export function checkCopy(text: string): ComplianceViolation[] {
  const out: ComplianceViolation[] = [];
  for (const { re, label } of BANNED_PATTERNS) {
    const m = re.exec(text);
    if (m) out.push({ label, match: m[0] });
  }
  return out;
}

/**
 * Dev/CI assertion: throws if `text` contains banned copy. No-op effect in
 * production beyond the throw, so it's safe to wrap marketing strings.
 */
export function assertCompliant(text: string, where = "copy"): void {
  const violations = checkCopy(text);
  if (violations.length > 0) {
    const detail = violations.map((v) => `“${v.match}” (${v.label})`).join(", ");
    throw new Error(`Compliance violation in ${where}: ${detail}`);
  }
}
