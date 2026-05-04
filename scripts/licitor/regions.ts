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

/**
 * URL for the per-region "upcoming sales" listing.
 * Same `<ul class="AdResults">` markup as the historique pages, so
 * `parseIndexPage()` works unchanged. Listings here have no `Archives`
 * class on `a.Ad`, so the parser classifies them as `status='upcoming'`.
 *
 * Page sizing: 5 listings per page (Paris: 31 pages / ~152 listings as of
 * 2026-04). Total volume is small — typically <200 upcoming per region.
 */
export function upcomingUrl(region: RegionSlug, page: number): string {
  return `https://www.licitor.com/ventes-aux-encheres-immobilieres/${region}/prochaines-ventes.html?p=${page}`;
}
