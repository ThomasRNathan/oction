/**
 * Phase 1b: Detail scraper.
 * Fetches the `?print=1` detail page for every past_auctions row where
 * detail_fetched_at is null, parses full property/tribunal/lawyer/prices,
 * and updates the row.
 *
 * Fully resumable. Ctrl-C safe.
 *
 * CLI:  npx tsx scripts/licitor/scrape-detail.ts [batchSize]
 *   default batchSize = 600 (~25-35 min)
 */
import { db, writeDetail, markRemoved } from "./db";
import { politeFetch } from "./fetch";
import { parseDetailPage } from "./parser";

type Row = { licitor_id: number; url: string };

async function claimBatch(size: number): Promise<Row[]> {
  // Only fetch lot_index=0 — one detail page covers all lots of an announcement.
  const { data, error } = await db
    .from("past_auctions")
    .select("licitor_id, url")
    .eq("lot_index", 0)
    .is("detail_fetched_at", null)
    .limit(size);
  if (error) throw error;
  return (data ?? []) as Row[];
}

async function main() {
  const batchSize = parseInt(process.argv[2] ?? "600", 10);
  const batch = await claimBatch(batchSize);

  if (batch.length === 0) {
    console.log("No rows missing detail data. All done.");
    return;
  }

  console.log(
    `Claimed ${batch.length} listings for detail fetch. ETA ≈ ${Math.round((batch.length * 2.5) / 60)} min.`
  );

  let ok = 0;
  let removed = 0;
  let fail = 0;
  let consecFail = 0;
  const t0 = Date.now();

  for (const row of batch) {
    // Use ?print=1 — it's the slimmer template, 11-12 KB vs ~40+ KB
    const url = row.url.includes("?") ? `${row.url}&print=1` : `${row.url}?print=1`;
    try {
      const { status, body } = await politeFetch(url);
      if (status === 404) {
        await markRemoved(row.licitor_id);
        removed++;
        consecFail = 0;
        continue;
      }
      if (status !== 200) {
        throw new Error(`HTTP ${status}`);
      }
      const parsed = parseDetailPage(body, row.licitor_id);
      await writeDetail(parsed);
      ok++;
      consecFail = 0;
      if ((ok + removed) % 20 === 0 || ok + removed === batch.length) {
        const elapsed = (Date.now() - t0) / 1000;
        const done = ok + removed + fail;
        const rate = done / elapsed;
        const etaSec = (batch.length - done) / (rate || 1);
        console.log(
          `  ${ok}ok ${removed}removed ${fail}fail · ${rate.toFixed(2)} req/s · ETA ${Math.round(etaSec / 60)}m`
        );
      }
    } catch (e) {
      fail++;
      consecFail++;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  ✗ ${row.licitor_id}: ${msg}`);
      if (consecFail >= 5 && ok === 0) {
        console.error(
          "\n5 consecutive failures with no successes. Likely IP-blocked. Rotate VPN and re-run."
        );
        process.exit(2);
      }
    }
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log(
    `\nDone: ${ok} ok, ${removed} removed (404), ${fail} failed. Elapsed ${Math.round(elapsed / 60)}m.`
  );
  console.log(`BATCH DONE (detail): ok=${ok} removed=${removed} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
