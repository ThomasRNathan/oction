/**
 * Scrape all street workout spots from calisthenics-parks.com.
 *
 * Uses the site's public JSON API (same as the map page):
 *   GET /spots?limit=100&page=N
 *
 * Output: CSV + JSON with fields needed to rebuild a world map.
 *
 * Usage:
 *   npx tsx scripts/calisthenics-parks/scrape-spots.ts
 *   npx tsx scripts/calisthenics-parks/scrape-spots.ts --maxPages 5   # sample run
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const BASE_URL = "https://calisthenics-parks.com";
const PAGE_SIZE = 100;
const DELAY_MS = 350;

export type CalisthenicsSpot = {
  id: number;
  name: string | null;
  title: string;
  latitude: number;
  longitude: number;
  address: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  url: string;
};

type ApiSpot = {
  id: number;
  name: string | null;
  title: string;
  lat: number;
  lon: number;
  address: string | null;
  html: string | { l?: string; m?: string; s?: string };
};

type ApiResponse = {
  data: ApiSpot[];
  paginator: {
    total_count: number;
    total_pages: number;
    current_page: number;
    limit: number;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  let maxPages: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--maxPages") {
      const value = argv[i + 1];
      if (!value || !/^\d+$/.test(value)) {
        throw new Error("Expected number after --maxPages");
      }
      maxPages = parseInt(value, 10);
      i++;
    }
  }
  return { maxPages };
}

function slugToLabel(slug: string): string {
  const parts = slug.split("-");
  const enIndex = parts.indexOf("en");
  const nameParts = enIndex >= 0 ? parts.slice(enIndex + 1) : parts;
  return nameParts.join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseLocation(html: string) {
  const countries = [...html.matchAll(/\/countries\/([a-z]{2})-en-([^"'\s]+)/g)];
  const regions = [...html.matchAll(/\/regions\/(\d+)-en-([^"'\s]+)/g)];
  const cities = [...html.matchAll(/\/cities\/(\d+)-en-([^"'\s?]+)/g)];

  const country = countries[0];
  const city = cities[0];

  // Prefer sub-region over continent when both exist.
  const region =
    regions.length > 1
      ? regions[regions.length - 1]
      : regions[0] ?? null;

  return {
    countryCode: country?.[1] ?? null,
    country: country ? slugToLabel(country[2]) : null,
    region: region ? slugToLabel(region[2]) : null,
    city: city ? slugToLabel(city[2]) : null,
  };
}

function toSpot(apiSpot: ApiSpot): CalisthenicsSpot {
  const html =
    typeof apiSpot.html === "string"
      ? apiSpot.html
      : (apiSpot.html.l ?? apiSpot.html.m ?? apiSpot.html.s ?? "");

  const location = parseLocation(html);

  return {
    id: apiSpot.id,
    name: apiSpot.name,
    title: apiSpot.title,
    latitude: apiSpot.lat,
    longitude: apiSpot.lon,
    address: apiSpot.address,
    country: location.country,
    countryCode: location.countryCode,
    region: location.region,
    city: location.city,
    url: `${BASE_URL}/spots/${apiSpot.id}`,
  };
}

async function fetchPage(page: number): Promise<ApiResponse> {
  const url = new URL("/spots", BASE_URL);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on page ${page}`);
  }

  return (await response.json()) as ApiResponse;
}

function toCsv(spots: CalisthenicsSpot[]): string {
  const headers = [
    "id",
    "name",
    "title",
    "latitude",
    "longitude",
    "address",
    "country",
    "country_code",
    "region",
    "city",
    "url",
  ];

  const escape = (value: string | number | null) => {
    if (value === null) return "";
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const rows = spots.map((spot) =>
    [
      spot.id,
      spot.name,
      spot.title,
      spot.latitude,
      spot.longitude,
      spot.address,
      spot.country,
      spot.countryCode,
      spot.region,
      spot.city,
      spot.url,
    ]
      .map(escape)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

async function main() {
  const { maxPages } = parseArgs(process.argv.slice(2));
  const spots: CalisthenicsSpot[] = [];
  const seen = new Set<number>();

  const first = await fetchPage(1);
  const totalPages = maxPages ?? first.paginator.total_pages;
  const totalCount = first.paginator.total_count;

  console.log(
    `Fetching ${totalCount} spots across ${totalPages} pages (limit=${PAGE_SIZE})...`,
  );

  for (let page = 1; page <= totalPages; page++) {
    const payload = page === 1 ? first : await fetchPage(page);

    for (const apiSpot of payload.data) {
      if (seen.has(apiSpot.id)) continue;
      seen.add(apiSpot.id);

      if (!Number.isFinite(apiSpot.lat) || !Number.isFinite(apiSpot.lon)) {
        continue;
      }

      spots.push(toSpot(apiSpot));
    }

    if (page % 10 === 0 || page === totalPages) {
      console.log(`  page ${page}/${totalPages} — ${spots.length} spots`);
    }

    if (page < totalPages) {
      await sleep(DELAY_MS);
    }
  }

  const outDir = join(process.cwd(), "lib/data");
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, "calisthenics-parks-spots.json");
  const csvPath = join(outDir, "calisthenics-parks-spots.csv");

  writeFileSync(jsonPath, JSON.stringify(spots, null, 2));
  writeFileSync(csvPath, toCsv(spots));

  console.log(`\nDone. Wrote ${spots.length} spots:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
