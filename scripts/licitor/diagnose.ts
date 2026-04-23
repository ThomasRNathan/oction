/**
 * One-off: parse a multi-lot page and upsert via the real helper,
 * to verify the compound PK + lot_index flow end-to-end.
 */
import { readFileSync } from "node:fs";
import { upsertIndexListings } from "./db";
import { parseIndexPage } from "./parser";

async function main() {
  const html = readFileSync("/tmp/fail_sop_p1.html", "utf8");
  const { listings } = parseIndexPage(html, "sud-ouest-pyrenees");
  console.log(`Parsed ${listings.length} listings (compound keys):`);
  for (const l of listings) {
    console.log(`  ${l.licitor_id}-${l.lot_index}  ${l.property_type}  ${l.index_price}€`);
  }
  try {
    await upsertIndexListings(listings);
    console.log("\n✓ upsert succeeded");
  } catch (e) {
    console.log("\n✗ upsert FAILED:", e instanceof Error ? e.message : JSON.stringify(e));
  }
}

main();
