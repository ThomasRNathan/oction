/**
 * Scrape complementary info from each spot's detail page on calisthenics-parks.com.
 *
 * Resumable: progress is saved every 25 spots. Safe to Ctrl-C and restart.
 *
 * Usage:
 *   npx tsx scripts/calisthenics-parks/scrape-spot-details.ts
 *   npx tsx scripts/calisthenics-parks/scrape-spot-details.ts --max 100
 */
import * as cheerio from "cheerio";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CalisthenicsSpot } from "../../lib/calisthenics-parks/types";
import type { CalisthenicsSpotDetail } from "../../lib/calisthenics-parks/types";

const BASE_URL = "https://calisthenics-parks.com";
const DELAY_MS = 450;
const SAVE_EVERY = 25;

const DATA_DIR = join(process.cwd(), "lib/data");
const SPOTS_PATH = join(DATA_DIR, "calisthenics-parks-spots.json");
const DETAILS_PATH = join(DATA_DIR, "calisthenics-parks-details.json");
const PROGRESS_PATH = join(
  DATA_DIR,
  "calisthenics-parks-details-progress.json",
);

type Progress = {
  completedIds: number[];
  errors: { id: number; error: string }[];
  startedAt: string;
  updatedAt: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  let max: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--max") {
      const value = argv[i + 1];
      if (!value || !/^\d+$/.test(value)) {
        throw new Error("Expected number after --max");
      }
      max = parseInt(value, 10);
      i++;
    }
  }
  return { max };
}

function loadProgress(): Progress {
  if (!existsSync(PROGRESS_PATH)) {
    const now = new Date().toISOString();
    return { completedIds: [], errors: [], startedAt: now, updatedAt: now };
  }
  return JSON.parse(readFileSync(PROGRESS_PATH, "utf8")) as Progress;
}

function loadDetails(): Record<string, CalisthenicsSpotDetail> {
  if (!existsSync(DETAILS_PATH)) return {};
  return JSON.parse(readFileSync(DETAILS_PATH, "utf8")) as Record<
    string,
    CalisthenicsSpotDetail
  >;
}

function loadSpots(): CalisthenicsSpot[] {
  if (!existsSync(SPOTS_PATH)) {
    throw new Error(`Missing ${SPOTS_PATH} — run npm run calisthenics:scrape first`);
  }
  return JSON.parse(readFileSync(SPOTS_PATH, "utf8")) as CalisthenicsSpot[];
}

function absoluteUrl(src: string): string {
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http")) return src;
  return `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

function parseRating(metaDescription: string): number | null {
  const match = metaDescription.match(/Rating\s+(\d+)\s*\/\s*(\d+)/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function parseDetailHtml(html: string, id: number): CalisthenicsSpotDetail {
  const $ = cheerio.load(html);
  const metaDescription = $('meta[name="description"]').attr("content") ?? "";

  const rating = parseRating(metaDescription);

  const disciplines: string[] = [];
  $("#discipline a[title]").each((_, el) => {
    const label = $(el).attr("title")?.trim();
    if (label) disciplines.push(label);
  });

  const equipment: string[] = [];
  $("#equipment a[title]").each((_, el) => {
    const label = $(el).attr("title")?.trim();
    if (label) equipment.push(label);
  });

  const tags: string[] = [];
  $("#spotsMoreDetails .label.tags").each((_, el) => {
    const label = $(el).text().trim();
    if (label) tags.push(label);
  });

  const images: string[] = [];
  $("#attachments a[data-gallery]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) images.push(absoluteUrl(href));
  });
  if (images.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) images.push(ogImage);
  }

  const pageText = $.html();
  const illuminated = /cp-i-illuminated|illuminated spots/i.test(pageText);
  const roofed = /cp-i-roofed|roofed spots/i.test(pageText);
  const accessible = /cp-i-accessible|accessible spots/i.test(pageText);

  const commentHeading = $("#comments h3, #comments h4").first().text();
  const commentMatch = commentHeading.match(/(\d+)/);
  const commentCount = commentMatch ? parseInt(commentMatch[1], 10) : 0;

  return {
    id,
    rating,
    ratingMax: 4,
    disciplines,
    equipment,
    tags,
    images,
    illuminated,
    roofed,
    accessible,
    commentCount,
    scrapedAt: new Date().toISOString(),
  };
}

async function fetchSpotDetail(id: number): Promise<CalisthenicsSpotDetail> {
  const response = await fetch(`${BASE_URL}/spots/${id}`, {
    headers: {
      "User-Agent": "OctionCalisthenicsScraper/1.0 (personal map project)",
      Accept: "text/html",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseDetailHtml(html, id);
}

function saveAll(
  details: Record<string, CalisthenicsSpotDetail>,
  progress: Progress,
) {
  progress.updatedAt = new Date().toISOString();
  writeFileSync(DETAILS_PATH, JSON.stringify(details, null, 2));
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

async function main() {
  const { max } = parseArgs(process.argv.slice(2));
  mkdirSync(DATA_DIR, { recursive: true });

  const spots = loadSpots();
  const progress = loadProgress();
  const details = loadDetails();
  const done = new Set(progress.completedIds);

  const pending = spots.filter((s) => !done.has(s.id));
  const toScrape = max ? pending.slice(0, max) : pending;

  console.log(
    `Detail scrape: ${toScrape.length} remaining (${done.size}/${spots.length} already done)`,
  );

  let scraped = 0;

  for (const spot of toScrape) {
    try {
      const detail = await fetchSpotDetail(spot.id);
      details[String(spot.id)] = detail;
      progress.completedIds.push(spot.id);
      done.add(spot.id);
      scraped++;

      if (scraped % 10 === 0 || scraped === toScrape.length) {
        console.log(
          `  ${done.size}/${spots.length} — #${spot.id} (${detail.equipment.length} équip., ${detail.images.length} photos)`,
        );
      }

      if (scraped % SAVE_EVERY === 0) {
        saveAll(details, progress);
        console.log(`  💾 checkpoint (${done.size} total)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.errors.push({ id: spot.id, error: message });
      console.warn(`  ⚠ #${spot.id}: ${message}`);
    }

    await sleep(DELAY_MS);
  }

  saveAll(details, progress);
  console.log(
    `\nDone. ${progress.completedIds.length} details saved, ${progress.errors.length} errors.`,
  );
  console.log(`  ${DETAILS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
