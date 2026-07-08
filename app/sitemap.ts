import type { MetadataRoute } from "next";
import { getAllVilles } from "@/lib/tribunaux";

const BASE = "https://oction.fr";

/** Public sitemap: landing, investor page, and every /encheres/[ville]. */
export default function sitemap(): MetadataRoute.Sitemap {
  const villes = getAllVilles().map((v) => ({
    url: `${BASE}/encheres/${v.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/investisseur`, changeFrequency: "monthly", priority: 0.7 },
    ...villes,
  ];
}
