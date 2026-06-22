import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  CalisthenicsSpot,
  CalisthenicsSpotDetail,
  CalisthenicsSpotEnriched,
} from "./types";

const DATA_DIR = join(process.cwd(), "lib/data");
const SPOTS_PATH = join(DATA_DIR, "calisthenics-parks-spots.json");
const DETAILS_PATH = join(DATA_DIR, "calisthenics-parks-details.json");

let cachedSpots: CalisthenicsSpot[] | null = null;
let cachedDetails: Record<string, CalisthenicsSpotDetail> | null = null;
let cacheMtime = 0;

function fileMtime(path: string): number {
  if (!existsSync(path)) return 0;
  return statSync(path).mtimeMs;
}

function loadSpotsFile(): CalisthenicsSpot[] {
  if (!existsSync(SPOTS_PATH)) return [];
  return JSON.parse(readFileSync(SPOTS_PATH, "utf8")) as CalisthenicsSpot[];
}

function loadDetailsFile(): Record<string, CalisthenicsSpotDetail> {
  if (!existsSync(DETAILS_PATH)) return {};
  return JSON.parse(readFileSync(DETAILS_PATH, "utf8")) as Record<
    string,
    CalisthenicsSpotDetail
  >;
}

function refreshCacheIfNeeded() {
  const mtime = Math.max(fileMtime(SPOTS_PATH), fileMtime(DETAILS_PATH));
  if (cachedSpots && mtime <= cacheMtime) return;
  cachedSpots = loadSpotsFile();
  cachedDetails = loadDetailsFile();
  cacheMtime = mtime;
}

export function getCalisthenicsSpots(): CalisthenicsSpotEnriched[] {
  refreshCacheIfNeeded();
  const spots = cachedSpots ?? [];
  const details = cachedDetails ?? {};

  return spots.map((spot) => {
    const detail = details[String(spot.id)];
    return detail ? { ...spot, detail } : spot;
  });
}

export function getCalisthenicsMeta() {
  const spots = getCalisthenicsSpots();
  const countries = [
    ...new Set(spots.map((s) => s.country).filter(Boolean) as string[]),
  ].sort();

  return {
    total: spots.length,
    withDetails: spots.filter((s) => s.detail).length,
    countries,
  };
}

export type Bbox = [west: number, south: number, east: number, north: number];

export function filterByBbox(
  spots: CalisthenicsSpotEnriched[],
  bbox: Bbox,
): CalisthenicsSpotEnriched[] {
  const [west, south, east, north] = bbox;
  return spots.filter(
    (s) =>
      s.latitude >= south &&
      s.latitude <= north &&
      s.longitude >= west &&
      s.longitude <= east,
  );
}
