/**
 * One-off: seed the scrape_progress table with one row per (region, page).
 * Total: 6,333 rows.
 *
 * Run: npx tsx scripts/licitor/seed-progress.ts
 */
import { db } from "./db";
import { REGIONS } from "./regions";

async function main() {
  const rows = REGIONS.flatMap(({ slug, totalPages }) =>
    Array.from({ length: totalPages }, (_, i) => ({
      id: `${slug}-${i + 1}`,
      region: slug,
      page: i + 1,
      status: "pending" as const,
    }))
  );

  console.log(`Seeding ${rows.length} scrape_progress rows…`);

  // Upsert in chunks to stay within Supabase payload limits
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await db
      .from("scrape_progress")
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error(`Chunk ${i}-${i + chunk.length} failed:`, error);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
