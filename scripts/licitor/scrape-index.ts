/**
 * Phase 1a: Index scraper.
 * Iterates through all pending rows in `scrape_progress`, fetches the corresponding
 * licitor regional-archive page, parses listings, upserts into `past_auctions`,
 * and marks the progress row as 'done' (or 'failed' with the error message).
 *
 * Fully resumable — safe to Ctrl-C any time and restart later.
 *
 * Batch control:
 *   - `npx tsx scripts/licitor/scrape-index.ts 200`
 *       → process at most 200 pending pages this run. (back-compat)
 *   - `npx tsx scripts/licitor/scrape-index.ts --maxRows 600`
 *       → stop once ~600 past_auctions rows were upserted this run.
 *   - `npx tsx scripts/licitor/scrape-index.ts --maxPages 200 --maxRows 600`
 *       → whichever limit is hit first.
 *
 * Default batch: 500 pages (~25-30 min).
 *
 * Recommended between batches: rotate VPN, then re-run.
 */
import { db, upsertIndexListings } from "./db";
import { politeFetch } from "./fetch";
import { parseIndexPage } from "./parser";
import { indexUrl, type RegionSlug } from "./regions";

type ProgressRow = {
  id: string;
  region: string;
  page: number;
  status: string;
};

type CliOptions = {
  maxPages: number;
  maxRows: number | null;
  includeDone: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  // Back-compat: if first arg is a number, treat it as maxPages.
  const first = argv[0];
  const numericFirst = first && /^\d+$/.test(first) ? parseInt(first, 10) : null;

  let maxPages = numericFirst ?? 500;
  let maxRows: number | null = null;
  let includeDone = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--maxPages") {
      const v = argv[i + 1];
      if (!v || !/^\d+$/.test(v)) throw new Error("Expected number after --maxPages");
      maxPages = parseInt(v, 10);
      i++;
      continue;
    }
    if (a === "--maxRows") {
      const v = argv[i + 1];
      if (!v || !/^\d+$/.test(v)) throw new Error("Expected number after --maxRows");
      maxRows = parseInt(v, 10);
      i++;
      continue;
    }
    if (a === "--includeDone") {
      includeDone = true;
      continue;
    }
  }

  return { maxPages, maxRows, includeDone };
}

async function claimBatch(size: number): Promise<ProgressRow[]> {
  // Simple claim: fetch pending rows, oldest failure first, then ordered by region+page.
  // Race-safe enough for single-process usage.
  const { data, error } = await db
    .from("scrape_progress")
    .select("id, region, page, status")
    .in("status", ["pending", "failed"])
    .order("page", { ascending: true })
    .limit(size);
  if (error) throw error;
  return (data ?? []) as ProgressRow[];
}

async function markDone(id: string, count: number) {
  await db
    .from("scrape_progress")
    .update({
      status: "done",
      listings_found: count,
      fetched_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", id);
}

async function markFailed(id: string, err: string) {
  await db
    .from("scrape_progress")
    .update({
      status: "failed",
      fetched_at: new Date().toISOString(),
      error: err.slice(0, 500),
    })
    .eq("id", id);
}

async function main() {
  const { maxPages, maxRows, includeDone } = parseArgs(process.argv.slice(2));

  const statuses: string[] = includeDone ? ["pending", "failed", "done"] : ["pending", "failed"];
  const { data, error } = await db
    .from("scrape_progress")
    .select("id, region, page, status")
    .in("status", statuses)
    .order("page", { ascending: true })
    .limit(maxPages);
  if (error) throw error;
  const batch = (data ?? []) as ProgressRow[];

  if (batch.length === 0) {
    console.log("No pending pages — all done.");
    return;
  }

  console.log(
    `Claimed ${batch.length} pending pages. ETA ≈ ${Math.round((batch.length * 2.5) / 60)} min.`
  );
  if (maxRows) console.log(`Row cap enabled: will stop after ~${maxRows} rows upserted.`);
  if (includeDone) console.log(`IncludeDone enabled: re-processing already done pages.`);

  let ok = 0;
  let fail = 0;
  let listings = 0;
  const t0 = Date.now();

  for (const row of batch) {
    if (maxRows && listings >= maxRows) {
      console.log(`Reached maxRows (${maxRows}). Stopping this batch early.`);
      break;
    }
    const url = indexUrl(row.region as RegionSlug, row.page);
    try {
      const { status, body } = await politeFetch(url);
      if (status === 404) {
        await markFailed(row.id, "HTTP 404");
        fail++;
        continue;
      }
      if (status !== 200) {
        await markFailed(row.id, `HTTP ${status}`);
        fail++;
        continue;
      }
      const { listings: parsed } = parseIndexPage(body, row.region);
      if (parsed.length > 0) {
        await upsertIndexListings(parsed);
      }
      await markDone(row.id, parsed.length);
      ok++;
      listings += parsed.length;
      if (maxRows && listings >= maxRows) {
        console.log(`Reached maxRows (${maxRows}). Stopping this batch early.`);
        break;
      }
      if (ok % 10 === 0 || ok === batch.length) {
        const elapsed = (Date.now() - t0) / 1000;
        const rate = ok / elapsed;
        const etaSec = (batch.length - ok - fail) / (rate || 1);
        console.log(
          `  ✓ ${ok}/${batch.length} pages · ${listings} listings · ${rate.toFixed(2)} pg/s · ETA ${Math.round(etaSec / 60)}m`
        );
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null
          ? JSON.stringify(e)
          : String(e);
      await markFailed(row.id, msg);
      fail++;
      console.warn(`  ✗ ${row.id}: ${msg}`);
      // If we've had 5+ consecutive failures, bail — probably IP-blocked
      if (fail >= 5 && ok === 0) {
        console.error(
          "\n5 consecutive failures with no successes. Likely IP-blocked. Rotate VPN and re-run."
        );
        process.exit(2);
      }
    }
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log(
    `\nDone: ${ok} ok, ${fail} failed, ${listings} listings upserted. Elapsed ${Math.round(elapsed / 60)}m.`
  );
  console.log(`BATCH DONE (index): pages_ok=${ok} pages_failed=${fail} rows_upserted=${listings}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
