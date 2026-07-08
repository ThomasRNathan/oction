/**
 * Build the programmatic-SEO ville dataset for /encheres/[ville].
 *
 * Source of truth = the auctions already in Supabase `past_auctions`. We group
 * every row by its normalized tribunal judiciaire (lib/analytics/normalize-
 * tribunal → "TJ Paris", "TJ Bordeaux", …), keep the TJ seats (drop Notaire /
 * unidentified), and aggregate real coverage stats per ville. Output is a
 * static JSON the [ville] pages and the landing's SEO hub read at build time.
 *
 *   pnpm tsx scripts/seo/build-villes.ts            # full
 *   pnpm tsx scripts/seo/build-villes.ts --min 5    # min auctions per ville
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { normalizeTribunal } from "../../lib/analytics/normalize-tribunal";
import {
  normalizePropertyType,
  type PropertyTypeBucket,
} from "../../lib/analytics/normalize-property-type";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const args = process.argv.slice(2);
const minAuctions = Number(
  args.includes("--min") ? args[args.indexOf("--min") + 1] : "5"
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing Supabase env");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Row {
  tribunal: string | null;
  city: string | null;
  department: string | null;
  status: string | null;
  property_type: string | null;
  mise_a_prix: number | string | null;
  adjudication_price: number | string | null;
  adj_dvf_ratio: number | string | null;
  auction_date: string | null;
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mode = (xs: string[]): string | null => {
  if (!xs.length) return null;
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
};
const slugify = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

interface Acc {
  label: string;
  ville: string;
  rows: Row[];
}

async function main() {
  const pageSize = 1000;
  const groups = new Map<string, Acc>();
  let from = 0;
  let scanned = 0;

  for (;;) {
    const { data, error } = await db
      .from("past_auctions")
      .select(
        "tribunal, city, department, status, property_type, mise_a_prix, adjudication_price, adj_dvf_ratio, auction_date"
      )
      .not("tribunal", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Row[]) {
      const label = normalizeTribunal(r.tribunal);
      // Keep tribunaux judiciaires only (drop Notaire / unidentified).
      if (!label || !label.startsWith("TJ ")) continue;
      const ville = label.replace(/^TJ /, "");
      if (!groups.has(label)) groups.set(label, { label, ville, rows: [] });
      groups.get(label)!.rows.push(r);
    }
    scanned += data.length;
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Scanned ${scanned} rows · ${groups.size} tribunaux judiciaires`);

  const villes = [...groups.values()]
    .map(({ label, ville, rows }) => {
      const sold = rows.filter((r) => r.status === "sold");
      const upcoming = rows.filter((r) => r.status === "upcoming");
      const maps = sold.map((r) => num(r.mise_a_prix)).filter((n): n is number => n != null && n > 0);
      const adjs = sold.map((r) => num(r.adjudication_price)).filter((n): n is number => n != null && n > 0);
      const ratios = sold
        .map((r) => num(r.adj_dvf_ratio))
        .filter((n): n is number => n != null && n > 0.05 && n < 5);
      const medRatio = median(ratios);

      const typeCounts = new Map<PropertyTypeBucket, number>();
      for (const r of rows) {
        const t = normalizePropertyType(r.property_type);
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
      const topPropertyTypes = [...typeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([type, count]) => ({ type, count }));

      const dates = rows
        .map((r) => r.auction_date)
        .filter((d): d is string => !!d)
        .sort();

      return {
        slug: slugify(ville),
        ville,
        tribunal: `Tribunal Judiciaire de ${ville}`,
        department: mode(rows.map((r) => r.department).filter((d): d is string => !!d)),
        stats: {
          total: rows.length,
          sold: sold.length,
          upcoming: upcoming.length,
          medianMiseAPrix: median(maps),
          medianAdjudication: median(adjs),
          // Décote médiane vs marché DVF (1 − adj/DVF), sold rows with DVF.
          medianDecoteVsDvf: medRatio != null ? Math.round((1 - medRatio) * 100) / 100 : null,
        },
        topPropertyTypes,
        lastAuctionDate: dates.length ? dates[dates.length - 1] : null,
      };
    })
    .filter((v) => v.stats.total >= minAuctions)
    .sort((a, b) => b.stats.total - a.stats.total);

  const outPath = resolve(process.cwd(), "lib/tribunaux/villes.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(villes, null, 2) + "\n");
  console.log(
    `Wrote ${villes.length} villes (min ${minAuctions} auctions) → lib/tribunaux/villes.json`
  );
  console.log(
    "Top 10:",
    villes.slice(0, 10).map((v) => `${v.ville}(${v.stats.total})`).join(", ")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
