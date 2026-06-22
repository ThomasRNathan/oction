/**
 * One-shot analysis: rank upcoming auctions (next 12 weeks) by
 * "buyer-friendliness" using historical cohort statistics.
 *
 * Definitions:
 *   - uncontested rate = share of past sales in the cohort where
 *     adjudication ≤ 1.05 × mise à prix (you bought essentially at the
 *     floor — most buyer-friendly outcome).
 *   - market discount = median(1 - adjudication_per_sqm / DVF_median)
 *     across the cohort. Only defined when surface + adj + DVF available.
 *   - surenchère ratio = mean(adjudication / MAP). Lower = better.
 *
 * Cohort tiers (most specific wins for the per-listing recommendation):
 *   - (tribunal, city, type)  — most granular, can be noisy
 *   - (city, type)            — used for the city × type table
 *   - (tribunal, type)        — used for the tribunal × type table
 *   - (tribunal)              — global tribunal stats
 *
 * Run with:
 *   npx tsx scripts/analytics/recommend-upcoming.ts
 *
 * Writes nothing — prints markdown to stdout.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import sidecar from "@/lib/data/past-auctions-browse.json";
import { normalizeTribunal } from "@/lib/analytics/normalize-tribunal";
import {
  normalizePropertyType,
  type PropertyTypeBucket,
} from "@/lib/analytics/normalize-property-type";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
interface SidecarRow {
  id: number;
  url: string | null;
  city: string | null;
  department: string | null;
  propertyType: PropertyTypeBucket;
  tribunal: string | null;
  surface: number | null;
  miseAPrix: number;
  adjudication: number;
  auctionDate: string | null;
  year: number | null;
  uncontestedRatio: number;     // adj / MAP
  marketRatio: number | null;   // adj_per_sqm / dvf_median (when both available)
}

interface UpcomingRow {
  licitor_id: number;
  url: string;
  city: string | null;
  department_code: string | null;
  property_type: string | null;
  property_description: string | null;
  tribunal: string | null;
  mise_a_prix: number | null;
  auction_date: string | null;
  visit_date: string | null;
  occupancy: string | null;
  surface: number | null;
}

interface CohortStats {
  key: string;
  n: number;                    // total sales in cohort
  uncontestedRate: number;      // 0..1
  medianSurenchere: number;     // multiplier (1.20 = +20%)
  meanSurenchere: number;
  medianMarketDiscount: number | null; // 0..1 (0.40 = bought 40% below DVF)
  marketN: number;              // count with DVF data
}

const ALL_ROWS = sidecar.rows as SidecarRow[];

// ──────────────────────────────────────────────────────────────────────────
// Cohort builder
// ──────────────────────────────────────────────────────────────────────────
function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Group rows by a key function and compute stats per group.
 * Filter to past 5 years to stay relevant (auction market drifts).
 */
function buildCohorts(
  keyFn: (r: SidecarRow) => string | null,
  minN = 10
): CohortStats[] {
  const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 86400_000)
    .toISOString()
    .slice(0, 10);

  const groups = new Map<string, SidecarRow[]>();
  for (const r of ALL_ROWS) {
    if (!r.adjudication || !r.miseAPrix) continue;
    if (r.adjudication < r.miseAPrix * 0.5) continue; // garbage rows (re-vente at huge discount)
    if (!r.auctionDate || r.auctionDate < fiveYearsAgo) continue;

    const k = keyFn(r);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const stats: CohortStats[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < minN) continue;

    const ratios = rows.map((r) => r.uncontestedRatio);
    const uncontested = rows.filter((r) => r.uncontestedRatio <= 1.05).length;
    const marketRatios = rows
      .map((r) => r.marketRatio)
      .filter((x): x is number => x != null && x > 0 && x < 5);

    stats.push({
      key,
      n: rows.length,
      uncontestedRate: uncontested / rows.length,
      medianSurenchere: median(ratios),
      meanSurenchere: mean(ratios),
      medianMarketDiscount:
        marketRatios.length >= 5 ? 1 - median(marketRatios) : null,
      marketN: marketRatios.length,
    });
  }

  return stats;
}

// ──────────────────────────────────────────────────────────────────────────
// Pretty-printing
// ──────────────────────────────────────────────────────────────────────────
const PCT = (x: number, d = 0) =>
  isFinite(x) ? `${(x * 100).toFixed(d)} %` : "—";
const EUR = (x: number | null | undefined) =>
  x != null
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(x)
    : "—";

// ──────────────────────────────────────────────────────────────────────────
// Supabase fetch (REST — bypasses realtime ws dep)
// ──────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchAll<T>(query: string): Promise<T[]> {
  // Paginate with Range header — Supabase caps at 1000/req.
  const out: T[] = [];
  let from = 0;
  const step = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + step - 1}`,
      },
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const batch = (await r.json()) as T[];
    out.push(...batch);
    if (batch.length < step) break;
    from += step;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 84 * 86400_000)
    .toISOString()
    .slice(0, 10);

  console.error(`[fetch] upcoming ${today} → ${horizon} (84 days)`);

  const upcoming = await fetchAll<UpcomingRow>(
    `past_auctions?status=eq.upcoming` +
      `&auction_date=gte.${today}&auction_date=lte.${horizon}` +
      `&tribunal=not.is.null&mise_a_prix=not.is.null` +
      `&select=licitor_id,url,city,department_code,property_type,property_description,tribunal,mise_a_prix,auction_date,visit_date,occupancy,surface` +
      `&order=auction_date.asc`
  );
  console.error(`[fetch] ${upcoming.length} upcoming rows`);

  // ── Cohort tables ──
  const byTrib = buildCohorts((r) => r.tribunal, 50);
  const byTribType = buildCohorts(
    (r) => (r.tribunal ? `${r.tribunal} · ${r.propertyType}` : null),
    20
  );
  const byCityType = buildCohorts(
    (r) => (r.city ? `${r.city} · ${r.propertyType}` : null),
    15
  );

  // Index for lookup
  const tribTypeIdx = new Map(byTribType.map((c) => [c.key, c]));
  const cityTypeIdx = new Map(byCityType.map((c) => [c.key, c]));
  const tribIdx = new Map(byTrib.map((c) => [c.key, c]));

  // ── Strategic layer: top cohorts by uncontested rate ──
  console.log("# Recommandations enchères — analyse strategique\n");
  console.log(`_Généré le ${today} · horizon ${horizon} (84 jours)_\n`);
  console.log(
    `Univers : 20 171 ventes historiques (5 dernières années) · ${upcoming.length} ventes annoncées sur la fenêtre.\n`
  );

  console.log("## 1. Top tribunaux × type — taux d'adjudication au plancher\n");
  console.log(
    "Probabilité que l'adjudication se fasse à ≤ 1,05 × mise à prix (vous gagnez au plancher).\n"
  );
  console.log("| Rang | Tribunal × type | n | % au plancher | Surenchère médiane | Décote marché |");
  console.log("|---|---|---:|---:|---:|---:|");
  const topTribType = byTribType
    .filter((c) => c.n >= 30)
    .sort((a, b) => b.uncontestedRate - a.uncontestedRate)
    .slice(0, 20);
  topTribType.forEach((c, i) => {
    console.log(
      `| ${i + 1} | ${c.key} | ${c.n} | **${PCT(c.uncontestedRate)}** | ` +
        `${c.medianSurenchere.toFixed(2)}× | ` +
        `${c.medianMarketDiscount != null ? PCT(c.medianMarketDiscount) : "—"} |`
    );
  });
  console.log();

  console.log("## 2. Top villes × type — taux d'adjudication au plancher\n");
  console.log("| Rang | Ville × type | n | % au plancher | Surenchère médiane | Décote marché |");
  console.log("|---|---|---:|---:|---:|---:|");
  const topCityType = byCityType
    .filter((c) => c.n >= 20)
    .sort((a, b) => b.uncontestedRate - a.uncontestedRate)
    .slice(0, 25);
  topCityType.forEach((c, i) => {
    console.log(
      `| ${i + 1} | ${c.key} | ${c.n} | **${PCT(c.uncontestedRate)}** | ` +
        `${c.medianSurenchere.toFixed(2)}× | ` +
        `${c.medianMarketDiscount != null ? PCT(c.medianMarketDiscount) : "—"} |`
    );
  });
  console.log();

  // ── Bobigny deep-dive (user's hunch) ──
  console.log("## 3. Bobigny — confirmation de l'intuition\n");
  const bobigny = tribIdx.get("TJ Bobigny");
  if (bobigny) {
    console.log(
      `- **${bobigny.n} ventes** au TJ Bobigny ces 5 dernières années`
    );
    console.log(
      `- **${PCT(bobigny.uncontestedRate)} adjugées au plancher** (≤ 1,05 × MAP)`
    );
    console.log(
      `- Surenchère médiane : **${bobigny.medianSurenchere.toFixed(2)}×** la mise à prix`
    );
    if (bobigny.medianMarketDiscount != null)
      console.log(
        `- Décote vs marché DVF : **${PCT(bobigny.medianMarketDiscount)}** (sur ${bobigny.marketN} ventes avec DVF)`
      );
  }
  const bobignyTypes = byTribType
    .filter((c) => c.key.startsWith("TJ Bobigny ·"))
    .sort((a, b) => b.uncontestedRate - a.uncontestedRate);
  if (bobignyTypes.length) {
    console.log("\nPar type de bien à Bobigny :\n");
    console.log("| Type | n | % au plancher | Décote marché |");
    console.log("|---|---:|---:|---:|");
    for (const c of bobignyTypes) {
      console.log(
        `| ${c.key.replace("TJ Bobigny · ", "")} | ${c.n} | **${PCT(c.uncontestedRate)}** | ` +
          `${c.medianMarketDiscount != null ? PCT(c.medianMarketDiscount) : "—"} |`
      );
    }
  }
  console.log();

  // ── Tactical layer: upcoming auctions ranked ──
  console.log("## 4. Top ventes à venir (12 prochaines semaines)\n");
  console.log(
    "Notées par le score du cohort (ville × type quand n ≥ 15, sinon tribunal × type, sinon tribunal).\n"
  );

  const scored = upcoming
    .map((u) => {
      const bucket = normalizePropertyType(u.property_type);
      const tribNorm = normalizeTribunal(u.tribunal);
      // Try city × type first (most specific)
      const cityKey = u.city ? `${u.city} · ${bucket}` : null;
      const tribKey = tribNorm ? `${tribNorm} · ${bucket}` : null;
      const tribOnly = tribNorm;

      const cohort =
        (cityKey && cityTypeIdx.get(cityKey)) ||
        (tribKey && tribTypeIdx.get(tribKey)) ||
        (tribOnly && tribIdx.get(tribOnly)) ||
        null;
      const cohortScope = cohort
        ? cityKey && cityTypeIdx.get(cityKey)
          ? "ville×type"
          : tribKey && tribTypeIdx.get(tribKey)
            ? "trib×type"
            : "tribunal"
        : null;

      return { u, bucket, tribNorm, cohort, cohortScope };
    })
    .filter((s) => s.cohort != null);

  // Rank by uncontested rate × log(1 + n) for confidence
  scored.sort((a, b) => {
    const sa =
      a.cohort!.uncontestedRate * Math.log10(1 + a.cohort!.n);
    const sb =
      b.cohort!.uncontestedRate * Math.log10(1 + b.cohort!.n);
    return sb - sa;
  });

  console.log("| Date | Ville | Type | MAP | Tribunal | Cohort | n | % plancher | URL |");
  console.log("|---|---|---|---:|---|---|---:|---:|---|");
  for (const s of scored.slice(0, 30)) {
    const { u, bucket, cohort, cohortScope } = s;
    const shortUrl = u.url.replace(/^https:\/\/www\./, "");
    console.log(
      `| ${u.auction_date ?? "—"} | ${u.city ?? "—"} | ${bucket} | ${EUR(u.mise_a_prix)} | ` +
        `${s.tribNorm ?? "—"} | ${cohortScope} | ${cohort!.n} | ` +
        `**${PCT(cohort!.uncontestedRate)}** | [voir](${shortUrl}) |`
    );
  }
  console.log();

  // ── Bobigny upcoming specifically ──
  console.log("## 5. Ventes à venir au TJ Bobigny\n");
  const bobignyUpcoming = scored.filter(
    (s) => s.tribNorm === "TJ Bobigny"
  );
  console.log(
    `${bobignyUpcoming.length} lots prévus à Bobigny sur la fenêtre.\n`
  );
  console.log("| Date | Ville | Type | Surface | MAP | n cohort | % plancher | URL |");
  console.log("|---|---|---|---:|---:|---:|---:|---|");
  for (const s of bobignyUpcoming.slice(0, 25)) {
    const { u, bucket, cohort } = s;
    const shortUrl = u.url.replace(/^https:\/\/www\./, "");
    console.log(
      `| ${u.auction_date} | ${u.city ?? "—"} | ${bucket} | ` +
        `${u.surface != null ? Math.round(u.surface) + " m²" : "—"} | ` +
        `${EUR(u.mise_a_prix)} | ${cohort!.n} | ` +
        `**${PCT(cohort!.uncontestedRate)}** | [voir](${shortUrl}) |`
    );
  }
  console.log();

  console.log("---\n");
  console.log(
    `_Méthodologie : cohort = (tribunal/ville × type de bien) sur 20 171 ` +
      `ventes des 5 dernières années. "% plancher" = part des ventes adjugées ` +
      `à ≤ 1,05 × mise à prix. "Décote marché" = écart médian entre €/m² adjugé ` +
      `et €/m² médian DVF dans le secteur. Seuils de N : 30 pour le top tribunal ` +
      `× type, 20 pour les villes × type, 15 pour le matching d'une vente à venir._`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
