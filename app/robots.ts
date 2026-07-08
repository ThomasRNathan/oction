import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep the gated tool and API surface out of the index.
        disallow: ["/admin", "/api"],
      },
    ],
    sitemap: "https://oction.fr/sitemap.xml",
  };
}
