/**
 * Diagnostic: fetch the same licitor URL via three transports and compare.
 *
 *   1. node:fetch  — what `politeFetch` (the production scraper) uses today.
 *   2. Playwright  — chromium-headless-shell, full browser stack.
 *   3. Puppeteer   — bundled Chromium, full browser stack.
 *
 * For each (URL × transport) combo we report:
 *   - HTTP status (or transport error)
 *   - response byte count
 *   - wall-clock latency
 *   - whether `parseDetailPage` finds the markers the production parser needs
 *     (city, mise_a_prix, visit_date, lawyer_name, auction_date)
 *
 * Run:  npx tsx scripts/licitor/compare-fetchers.ts
 *
 * Why: today's Phase B detail-fetch saw five `TypeError: fetch failed` rows
 * survive 4 retries each — possibly a TLS-fingerprint or HTTP/2 issue that a
 * real browser wouldn't have. This script tells us whether to swap transports.
 */
import { chromium as pwChromium } from "playwright";
import puppeteer from "puppeteer";
import { parseDetailPage } from "./parser";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const URLS = [
  "https://www.licitor.com/annonce/10/80/64/vente-aux-encheres/un-immeuble/le-blanc-mesnil/seine-saint-denis/108064.html?print=1",
  "https://www.licitor.com/annonce/10/80/62/vente-aux-encheres/un-appartement/paris-16eme/paris/108062.html?print=1",
  "https://www.licitor.com/annonce/10/79/94/vente-aux-encheres/un-appartement/paris-17eme/paris/107994.html?print=1",
];

type Result = {
  transport: string;
  url: string;
  ok: boolean;
  status: number | null;
  bytes: number;
  latencyMs: number;
  parsed: {
    city: string | null;
    auction_date: string | null;
    mise_a_prix: number | null;
    visit_date: string | null;
    lawyer_name: string | null;
  } | null;
  error: string | null;
};

function extractLicitorId(u: string): number {
  const m = u.match(/\/(\d+)\.html/);
  return m ? parseInt(m[1], 10) : 0;
}

function summarizeParsed(html: string, url: string) {
  if (!html) return null;
  try {
    const d = parseDetailPage(html, extractLicitorId(url));
    return {
      city: d.city,
      auction_date: d.auction_date,
      mise_a_prix: d.mise_a_prix,
      visit_date: d.visit_date,
      lawyer_name: d.lawyer_name,
    };
  } catch (err) {
    return null;
  }
}

// ── transport 1: node:fetch (matches politeFetch's headers) ─────────────────

async function viaNodeFetch(url: string): Promise<Result> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.text();
    return {
      transport: "node:fetch",
      url,
      ok: res.ok,
      status: res.status,
      bytes: body.length,
      latencyMs: Date.now() - t0,
      parsed: summarizeParsed(body, url),
      error: null,
    };
  } catch (err) {
    return {
      transport: "node:fetch",
      url,
      ok: false,
      status: null,
      bytes: 0,
      latencyMs: Date.now() - t0,
      parsed: null,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

// ── transport 2: Playwright (chromium-headless-shell) ───────────────────────

async function viaPlaywright(urls: string[]): Promise<Result[]> {
  const browser = await pwChromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: "fr-FR" });
  const out: Result[] = [];
  try {
    for (const url of urls) {
      const t0 = Date.now();
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        const body = await page.content();
        out.push({
          transport: "playwright",
          url,
          ok: !!(resp && resp.ok()),
          status: resp ? resp.status() : null,
          bytes: body.length,
          latencyMs: Date.now() - t0,
          parsed: summarizeParsed(body, url),
          error: null,
        });
      } catch (err) {
        out.push({
          transport: "playwright",
          url,
          ok: false,
          status: null,
          bytes: 0,
          latencyMs: Date.now() - t0,
          parsed: null,
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}

// ── transport 3: Puppeteer ──────────────────────────────────────────────────

async function viaPuppeteer(urls: string[]): Promise<Result[]> {
  const browser = await puppeteer.launch({ headless: true });
  const out: Result[] = [];
  try {
    for (const url of urls) {
      const t0 = Date.now();
      const page = await browser.newPage();
      try {
        await page.setUserAgent(UA);
        await page.setExtraHTTPHeaders({ "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" });
        const resp = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        const body = await page.content();
        out.push({
          transport: "puppeteer",
          url,
          ok: !!(resp && resp.ok()),
          status: resp ? resp.status() : null,
          bytes: body.length,
          latencyMs: Date.now() - t0,
          parsed: summarizeParsed(body, url),
          error: null,
        });
      } catch (err) {
        out.push({
          transport: "puppeteer",
          url,
          ok: false,
          status: null,
          bytes: 0,
          latencyMs: Date.now() - t0,
          parsed: null,
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}

// ── reporter ────────────────────────────────────────────────────────────────

function shortUrl(u: string): string {
  const m = u.match(/\/(\d+)\.html/);
  return m ? `…${m[1]}.html?print=1` : u;
}

function fmt(r: Result): string {
  const head = `${r.transport.padEnd(11)} ${shortUrl(r.url).padEnd(22)}`;
  if (!r.ok) {
    return `${head}  ✗ status=${r.status ?? "—"} ${r.latencyMs}ms  ${r.error ?? ""}`;
  }
  const p = r.parsed;
  const flags = p
    ? [
        p.city ? "city" : "city✗",
        p.auction_date ? "date" : "date✗",
        p.mise_a_prix ? "mise" : "mise✗",
        p.visit_date ? "visit" : "visit✗",
        p.lawyer_name ? "lawyer" : "lawyer✗",
      ].join(" ")
    : "(no parse)";
  return `${head}  ✓ ${r.status} ${(r.bytes / 1024).toFixed(1)}KB ${r.latencyMs}ms  ${flags}`;
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Comparing 3 transports × ${URLS.length} URLs.\n`);

  // node:fetch sequentially (mirrors politeFetch usage; no concurrency)
  console.log("── node:fetch ──────────────────────────────────────────────");
  const nodeResults: Result[] = [];
  for (const u of URLS) {
    const r = await viaNodeFetch(u);
    console.log(`  ${fmt(r)}`);
    nodeResults.push(r);
  }

  console.log("\n── playwright ──────────────────────────────────────────────");
  const pwResults = await viaPlaywright(URLS);
  for (const r of pwResults) console.log(`  ${fmt(r)}`);

  console.log("\n── puppeteer ───────────────────────────────────────────────");
  const ppResults = await viaPuppeteer(URLS);
  for (const r of ppResults) console.log(`  ${fmt(r)}`);

  // Summary table
  console.log("\n── summary ─────────────────────────────────────────────────");
  const all = [...nodeResults, ...pwResults, ...ppResults];
  const byTransport = new Map<string, Result[]>();
  for (const r of all) {
    const list = byTransport.get(r.transport) ?? [];
    list.push(r);
    byTransport.set(r.transport, list);
  }
  for (const [t, rs] of byTransport) {
    const ok = rs.filter((r) => r.ok).length;
    const avgLat = Math.round(rs.reduce((s, r) => s + r.latencyMs, 0) / rs.length);
    const avgBytes = Math.round(rs.filter((r) => r.bytes > 0).reduce((s, r) => s + r.bytes, 0) / Math.max(1, rs.filter((r) => r.bytes > 0).length));
    console.log(`  ${t.padEnd(11)}  ok=${ok}/${rs.length}  avg_latency=${avgLat}ms  avg_bytes=${(avgBytes / 1024).toFixed(1)}KB`);
  }

  // Cross-transport parse equality check
  console.log("\n── parse equality ──────────────────────────────────────────");
  for (const url of URLS) {
    const nf = nodeResults.find((r) => r.url === url)?.parsed;
    const pw = pwResults.find((r) => r.url === url)?.parsed;
    const pp = ppResults.find((r) => r.url === url)?.parsed;
    const nfStr = JSON.stringify(nf);
    const pwStr = JSON.stringify(pw);
    const ppStr = JSON.stringify(pp);
    const sameNfPw = nfStr === pwStr;
    const sameNfPp = nfStr === ppStr;
    console.log(
      `  ${shortUrl(url).padEnd(22)}  node==pw:${sameNfPw ? "✓" : "✗"}  node==pp:${sameNfPp ? "✓" : "✗"}`
    );
    if (!sameNfPw || !sameNfPp) {
      console.log(`    node:  ${nfStr}`);
      console.log(`    pw:    ${pwStr}`);
      console.log(`    pp:    ${ppStr}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
