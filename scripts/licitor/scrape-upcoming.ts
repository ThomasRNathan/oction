/**
 * Weekly upcoming-auction scraper.
 *
 * Walks each region's archive index for upcoming rows, persists their detail
 * data (including the time-sensitive `visit_date`), and reconciles already-
 * detailed rows that have since transitioned to sold so analytics gets the
 * adjudication price too.
 *
 * Why a separate script: the existing `scrape-index.ts` / `scrape-detail.ts`
 * pair operates on a `scrape_progress` queue meant for one-shot full-archive
 * scraping. The weekly job has different dynamics — small, idempotent,
 * upcoming-only — and shouldn't touch the queue.
 *
 * Phases:
 *
 *   A. Index walk    — for each region, walk pages 1..MAX_PAGES_PER_REGION,
 *                      filter listings to status='upcoming', upsert via the
 *                      already-NULL-safe `upsertIndexListings`.
 *
 *   B. Detail fetch  — claim every status='upcoming', detail_fetched_at IS NULL
 *                      row whose auction_date is still in the near future; fetch
 *                      `?print=1`; persist via NULL-safe `writeDetail` so the
 *                      `visit_date` survives any future re-fetch.
 *
 *   C. Post-sale     — claim status='sold', adjudication_price IS NULL,
 *      reconciliation  detail_fetched_at IS NOT NULL rows (auctions we
 *                      detailed while upcoming, then index-flipped to sold);
 *                      re-fetch `?print=1` to capture adjudication_price.
 *                      visit_date is preserved by the NULL-safe writeDetail.
 *
 *   D. Stale sweep   — flip status='upcoming' rows whose auction_date is >14
 *                      days past to status='unknown' so Phase B doesn't keep
 *                      re-claiming ghosts.
 *
 * CLI:
 *   npx tsx scripts/licitor/scrape-upcoming.ts                # all phases
 *   npx tsx scripts/licitor/scrape-upcoming.ts --phase=index  # A only
 *   npx tsx scripts/licitor/scrape-upcoming.ts --phase=detail # B only
 *   npx tsx scripts/licitor/scrape-upcoming.ts --phase=postsale # C only
 *   npx tsx scripts/licitor/scrape-upcoming.ts --phase=sweep  # D only
 *   npx tsx scripts/licitor/scrape-upcoming.ts --maxPages=50  # raise per-region cap
 *
 * Idempotent — safe to re-run any time.
 */
import { db, upsertIndexListings, writeDetail, markRemoved } from "./db";
import { politeFetch } from "./fetch";
import { parseIndexPage, parseDetailPage } from "./parser";
import { REGIONS, upcomingUrl } from "./regions";

// ── tuning ──────────────────────────────────────────────────────────────────

const MAX_PAGES_PER_REGION = 50;     // Paris has ~31 pages of upcoming; 50 leaves headroom
const EARLY_EXIT_AFTER_K_EMPTY = 5;   // backstop: bail per-region after K empty pages
const PHASE_B_BATCH = 500;            // upcoming detail batch
const PHASE_C_BATCH = 500;            // post-sale reconciliation batch
const CONSEC_FAIL_BAIL = 3;           // tighter than the daily scrape (5)
const STALE_DAYS = 14;                // mark upcoming→unknown after N days past auction_date
const PHASE_B_FUTURE_GRACE_DAYS = 7;  // skip upcoming rows whose auction_date is >7 days in the past

// ── CLI ────────────────────────────────────────────────────────────────────

type Phase = "index" | "detail" | "postsale" | "sweep" | "all";

function parseArgs(argv: string[]): { phase: Phase; maxPages: number } {
  let phase: Phase = "all";
  let maxPages = MAX_PAGES_PER_REGION;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--phase=")) {
      const v = a.slice("--phase=".length);
      if (v !== "index" && v !== "detail" && v !== "postsale" && v !== "sweep" && v !== "all") {
        throw new Error(`Unknown --phase value: ${v}`);
      }
      phase = v;
      continue;
    }
    if (a.startsWith("--maxPages=")) {
      maxPages = parseInt(a.slice("--maxPages=".length), 10);
      if (!Number.isFinite(maxPages) || maxPages < 1) {
        throw new Error(`Invalid --maxPages: ${a}`);
      }
      continue;
    }
  }
  return { phase, maxPages };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function isoDateNDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function fmtElapsed(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, "0")}s`;
}

// ── Phase A: walk index pages, harvest upcoming rows ────────────────────────

async function phaseIndex(maxPages: number): Promise<{ upcoming: number; pages: number }> {
  console.log(`\n=== PHASE A — index walk (max ${maxPages} pages × ${REGIONS.length} regions) ===`);
  const t0 = Date.now();
  let totalUpcoming = 0;
  let totalPages = 0;

  for (const region of REGIONS) {
    const cap = Math.min(maxPages, region.totalPages);
    let regionUpcoming = 0;
    let consecutiveEmpty = 0;

    for (let p = 1; p <= cap; p++) {
      const url = upcomingUrl(region.slug, p);
      try {
        const { status, body } = await politeFetch(url);
        if (status !== 200) {
          console.warn(`  [${region.slug}] p${p} → HTTP ${status}, skipping`);
          continue;
        }
        const { listings } = parseIndexPage(body, region.slug);
        const upcoming = listings.filter((l) => l.status === "upcoming");
        if (upcoming.length > 0) {
          await upsertIndexListings(upcoming);
          regionUpcoming += upcoming.length;
          consecutiveEmpty = 0;
        } else {
          consecutiveEmpty++;
        }
        totalPages++;

        // Backstop early-exit: K consecutive pages with zero upcoming
        // (only applies after a comfortable warmup of pages).
        if (consecutiveEmpty >= EARLY_EXIT_AFTER_K_EMPTY && p >= EARLY_EXIT_AFTER_K_EMPTY) {
          console.log(
            `  [${region.slug}] early-exit at p${p} (${consecutiveEmpty} consecutive empty pages)`
          );
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  [${region.slug}] p${p} fetch failed: ${msg}`);
      }
    }

    totalUpcoming += regionUpcoming;
    console.log(`  [${region.slug}] +${regionUpcoming} upcoming rows`);
  }

  console.log(
    `Phase A done: ${totalUpcoming} upcoming rows across ${totalPages} pages, ` +
      `elapsed ${fmtElapsed(Date.now() - t0)}.`
  );
  return { upcoming: totalUpcoming, pages: totalPages };
}

// ── Phase B: detail-fetch every upcoming row that's not yet detailed ────────

type ClaimRow = { licitor_id: number; url: string };

async function claimUpcomingForDetail(): Promise<ClaimRow[]> {
  // Postgrest .or() with date comparator — `auction_date.is.null` covers rows
  // we haven't yet captured a date for (recently indexed, never detailed).
  const cutoff = isoDateNDaysAgo(PHASE_B_FUTURE_GRACE_DAYS);
  const { data, error } = await db
    .from("past_auctions")
    .select("licitor_id, url")
    .eq("lot_index", 0)
    .eq("status", "upcoming")
    .is("detail_fetched_at", null)
    .or(`auction_date.is.null,auction_date.gte.${cutoff}`)
    .limit(PHASE_B_BATCH);
  if (error) throw error;
  return (data ?? []) as ClaimRow[];
}

async function phaseDetail(): Promise<{ ok: number; removed: number; fail: number }> {
  console.log(`\n=== PHASE B — detail fetch for upcoming rows ===`);
  const t0 = Date.now();
  const batch = await claimUpcomingForDetail();
  if (batch.length === 0) {
    console.log("  Nothing to detail-fetch.");
    return { ok: 0, removed: 0, fail: 0 };
  }
  console.log(`  Claimed ${batch.length} rows. ETA ≈ ${Math.round((batch.length * 2.5) / 60)}m.`);

  let ok = 0;
  let removed = 0;
  let fail = 0;
  let consecFail = 0;

  for (const row of batch) {
    const url = row.url.includes("?") ? `${row.url}&print=1` : `${row.url}?print=1`;
    try {
      const { status, body } = await politeFetch(url);
      if (status === 404) {
        await markRemoved(row.licitor_id);
        removed++;
        consecFail = 0;
        continue;
      }
      if (status !== 200) throw new Error(`HTTP ${status}`);
      await writeDetail(parseDetailPage(body, row.licitor_id));
      ok++;
      consecFail = 0;
      if ((ok + removed) % 20 === 0 || ok + removed === batch.length) {
        const done = ok + removed + fail;
        const rate = done / ((Date.now() - t0) / 1000);
        const etaSec = (batch.length - done) / (rate || 1);
        console.log(
          `    ${ok}ok ${removed}removed ${fail}fail · ${rate.toFixed(2)} req/s · ETA ${Math.round(etaSec / 60)}m`
        );
      }
    } catch (err) {
      fail++;
      consecFail++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`    ✗ ${row.licitor_id}: ${msg}`);
      if (consecFail >= CONSEC_FAIL_BAIL && ok === 0) {
        console.error(
          `\n${CONSEC_FAIL_BAIL} consecutive failures with no successes — likely IP-blocked. ` +
            `Rotate VPN and re-run.`
        );
        process.exit(2);
      }
    }
  }

  console.log(`Phase B done: ${ok} ok, ${removed} removed, ${fail} fail, elapsed ${fmtElapsed(Date.now() - t0)}.`);
  return { ok, removed, fail };
}

// ── Phase C: re-detail rows that flipped to sold but have no adj price ──────

async function claimPostSaleReconciliation(): Promise<ClaimRow[]> {
  const { data, error } = await db
    .from("past_auctions")
    .select("licitor_id, url")
    .eq("lot_index", 0)
    .eq("status", "sold")
    .is("adjudication_price", null)
    .not("detail_fetched_at", "is", null)
    .limit(PHASE_C_BATCH);
  if (error) throw error;
  return (data ?? []) as ClaimRow[];
}

async function phasePostSale(): Promise<{ ok: number; removed: number; fail: number }> {
  console.log(`\n=== PHASE C — post-sale reconciliation (visit_date stays, adjudication_price fills in) ===`);
  const t0 = Date.now();
  const batch = await claimPostSaleReconciliation();
  if (batch.length === 0) {
    console.log("  Nothing to reconcile.");
    return { ok: 0, removed: 0, fail: 0 };
  }
  console.log(`  Claimed ${batch.length} rows. ETA ≈ ${Math.round((batch.length * 2.5) / 60)}m.`);

  let ok = 0;
  let removed = 0;
  let fail = 0;
  let consecFail = 0;

  for (const row of batch) {
    const url = row.url.includes("?") ? `${row.url}&print=1` : `${row.url}?print=1`;
    try {
      const { status, body } = await politeFetch(url);
      if (status === 404) {
        await markRemoved(row.licitor_id);
        removed++;
        consecFail = 0;
        continue;
      }
      if (status !== 200) throw new Error(`HTTP ${status}`);
      await writeDetail(parseDetailPage(body, row.licitor_id));
      ok++;
      consecFail = 0;
      if ((ok + removed) % 20 === 0 || ok + removed === batch.length) {
        const done = ok + removed + fail;
        const rate = done / ((Date.now() - t0) / 1000);
        const etaSec = (batch.length - done) / (rate || 1);
        console.log(
          `    ${ok}ok ${removed}removed ${fail}fail · ${rate.toFixed(2)} req/s · ETA ${Math.round(etaSec / 60)}m`
        );
      }
    } catch (err) {
      fail++;
      consecFail++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`    ✗ ${row.licitor_id}: ${msg}`);
      if (consecFail >= CONSEC_FAIL_BAIL && ok === 0) {
        console.error(
          `\n${CONSEC_FAIL_BAIL} consecutive failures with no successes — likely IP-blocked. ` +
            `Rotate VPN and re-run.`
        );
        process.exit(2);
      }
    }
  }

  console.log(`Phase C done: ${ok} ok, ${removed} removed, ${fail} fail, elapsed ${fmtElapsed(Date.now() - t0)}.`);
  return { ok, removed, fail };
}

// ── Phase D: sweep stale upcoming rows ──────────────────────────────────────

async function phaseSweep(): Promise<{ swept: number }> {
  console.log(`\n=== PHASE D — stale-status sweep (> ${STALE_DAYS}d past auction_date) ===`);
  const cutoff = isoDateNDaysAgo(STALE_DAYS);

  // Two-step: count + update so we can log the exact number swept.
  const { count, error: errCount } = await db
    .from("past_auctions")
    .select("*", { count: "exact", head: true })
    .eq("status", "upcoming")
    .lt("auction_date", cutoff);
  if (errCount) throw errCount;

  if (!count) {
    console.log("  Nothing to sweep.");
    return { swept: 0 };
  }

  const { error: errUpdate } = await db
    .from("past_auctions")
    .update({ status: "unknown", last_fetched_at: new Date().toISOString() })
    .eq("status", "upcoming")
    .lt("auction_date", cutoff);
  if (errUpdate) throw errUpdate;

  console.log(`Phase D done: ${count} rows swept upcoming → unknown.`);
  return { swept: count };
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const { phase, maxPages } = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  if (phase === "all" || phase === "index") {
    await phaseIndex(maxPages);
  }
  if (phase === "all" || phase === "detail") {
    await phaseDetail();
  }
  if (phase === "all" || phase === "postsale") {
    await phasePostSale();
  }
  if (phase === "all" || phase === "sweep") {
    await phaseSweep();
  }

  console.log(`\nTotal elapsed: ${fmtElapsed(Date.now() - t0)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
