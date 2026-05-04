/**
 * Quick dashboard: print progress of Phase 1.
 * Run: npx tsx scripts/licitor/status.ts
 */
import { db } from "./db";
import { REGIONS } from "./regions";

async function main() {
  console.log("=== INDEX SCRAPE PROGRESS ===");
  // Use count queries — the default select caps at 1000 rows.
  for (const { slug, totalPages } of REGIONS) {
    const { count: done } = await db
      .from("scrape_progress")
      .select("*", { count: "exact", head: true })
      .eq("region", slug)
      .eq("status", "done");
    const { count: failed } = await db
      .from("scrape_progress")
      .select("*", { count: "exact", head: true })
      .eq("region", slug)
      .eq("status", "failed");
    const d = done ?? 0;
    const f = failed ?? 0;
    const pending = totalPages - d - f;
    const pct = ((d / totalPages) * 100).toFixed(1);
    console.log(
      `  ${slug.padEnd(26)} ${d}/${totalPages} (${pct}%)  pending=${pending}  failed=${f}`
    );
  }

  // Detail progress
  const { count: total } = await db
    .from("past_auctions")
    .select("*", { count: "exact", head: true });
  const { count: totalDistinctAuctions } = await db
    .from("past_auctions")
    .select("licitor_id", { count: "exact", head: true })
    .eq("lot_index", 0);
  const { count: detailed } = await db
    .from("past_auctions")
    .select("*", { count: "exact", head: true })
    .not("detail_fetched_at", "is", null);
  const { count: sold } = await db
    .from("past_auctions")
    .select("*", { count: "exact", head: true })
    .eq("status", "sold");
  const { count: removed } = await db
    .from("past_auctions")
    .select("*", { count: "exact", head: true })
    .eq("status", "removed");

  console.log("\n=== DETAIL SCRAPE PROGRESS ===");
  console.log(`  total listings in DB:       ${total}`);
  console.log(`  distinct auctions (lot 0):  ${totalDistinctAuctions}`);
  console.log(`  detail fetched:             ${detailed}`);
  console.log(`    of which sold:            ${sold}`);
  console.log(`    of which 404'd (removed): ${removed}`);
  console.log(`  missing detail:             ${(total ?? 0) - (detailed ?? 0)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
