/**
 * The 6 licitor.com regional archive URLs and their pagination sizes.
 * Pages confirmed by recon on 2026-04-20.
 */
export const REGIONS = [
  { slug: "paris-et-ile-de-france", totalPages: 3356, totalListings: 16776 },
  { slug: "regions-du-nord-est",    totalPages: 2168, totalListings: 10840 },
  { slug: "sud-est-mediterrannee",  totalPages:  358, totalListings:  1789 },
  { slug: "bretagne-grand-ouest",   totalPages:  260, totalListings:  1298 },
  { slug: "sud-ouest-pyrenees",     totalPages:  146, totalListings:   726 },
  { slug: "centre-loire-limousin",  totalPages:   45, totalListings:   221 },
] as const;

export type RegionSlug = (typeof REGIONS)[number]["slug"];

export function indexUrl(region: RegionSlug, page: number): string {
  return `https://www.licitor.com/ventes-aux-encheres-immobilieres/${region}/historique-des-adjudications.html?p=${page}`;
}
