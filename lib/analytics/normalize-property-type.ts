/**
 * Normalize a raw `property_type` string from past_auctions / live licitor
 * pages into a small enum used by the uncontested-rates analytics.
 *
 * The raw text is extremely fragmented:
 *   "Un appartement"
 *   "Un appartement de trois pièces principales"
 *   "Une maison d'habitation"
 *   "Un pavillon d'habitation"
 *   "Un local commercial"
 *   "Un terrain à bâtir"
 *   ...
 *
 * Order of checks matters — earlier patterns win when multiple match
 * (e.g. "appartement avec parking" ⇒ appartement, not parking).
 */
export type PropertyTypeBucket =
  | "appartement"
  | "studio"
  | "maison"
  | "immeuble"
  | "parking"
  | "terrain"
  | "local"
  | "autre";

const RULES: ReadonlyArray<{ pattern: RegExp; bucket: PropertyTypeBucket }> = [
  // Studios are tagged before "appartement" because the user's hypothesis #7
  // is "studios attirent moins" — keep them separable.
  { pattern: /\bstudio\b/i, bucket: "studio" },
  { pattern: /\bappartement|duplex|triplex|loft\b/i, bucket: "appartement" },
  { pattern: /\b(maison|pavillon|villa|chalet|propri[ée]t[ée])\b/i, bucket: "maison" },
  { pattern: /\bimmeuble|ensemble immobilier\b/i, bucket: "immeuble" },
  { pattern: /\b(parking|garage|box|emplacement)\b/i, bucket: "parking" },
  { pattern: /\bterrain\b/i, bucket: "terrain" },
  {
    pattern:
      /\b(local|boutique|bureau|commerc(e|ial)|entrep[ôo]t|atelier|hangar|fonds)\b/i,
    bucket: "local",
  },
  // "Un logement" is generic — bucket as appartement (most common case)
  { pattern: /\blogement\b/i, bucket: "appartement" },
  // "Une chambre" / "Une pièce" — likely chambre de bonne, treat as studio-like
  { pattern: /\b(chambre|pi[èe]ce)\b/i, bucket: "studio" },
];

export function normalizePropertyType(
  raw: string | null | undefined
): PropertyTypeBucket {
  if (!raw) return "autre";
  const text = raw.toString();
  for (const { pattern, bucket } of RULES) {
    if (pattern.test(text)) return bucket;
  }
  return "autre";
}
