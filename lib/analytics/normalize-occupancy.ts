/**
 * Normalize raw `occupancy` to one of three buckets (or null when missing).
 *
 * In past_auctions, the cleaned values are: "occupé", "libre", "loué" —
 * but live property data may carry more verbose phrases like
 * "Bien occupé par les anciens propriétaires", "loué selon bail commercial",
 * "libre d'occupation à la vente".
 */
export type OccupancyBucket = "libre" | "occupé" | "loué" | null;

export function normalizeOccupancy(
  raw: string | null | undefined
): OccupancyBucket {
  if (!raw) return null;
  const text = raw.toString().toLowerCase();
  if (/\blibre\b/.test(text)) return "libre";
  // "loué" is a stronger signal than just "occupé" so check first
  if (/\blou[ée]\b|\bbail\b/.test(text)) return "loué";
  if (/\boccup[ée]\b/.test(text)) return "occupé";
  return null;
}
