/**
 * One-off: parse the three sample HTML files in /tmp and print JSON.
 * Run: npx tsx scripts/licitor/test-parser.ts
 */
import { readFileSync } from "node:fs";
import { parseIndexPage, parseDetailPage } from "./parser";

const idxHtml = readFileSync("/tmp/licitor_idf_p1.html", "utf8");
const idx = parseIndexPage(idxHtml, "paris-et-ile-de-france");
console.log("=== INDEX (IDF p=1) ===");
console.log("totalPages:", idx.totalPages);
console.log(`listings: ${idx.listings.length}`);
console.log(JSON.stringify(idx.listings, null, 2));

const pastHtml = readFileSync("/tmp/licitor_detail_past.html", "utf8");
console.log("\n=== DETAIL (past #107910) ===");
console.log(JSON.stringify(parseDetailPage(pastHtml, 107910), null, 2));

const futHtml = readFileSync("/tmp/licitor_detail_future.html", "utf8");
console.log("\n=== DETAIL (upcoming #108398) ===");
console.log(JSON.stringify(parseDetailPage(futHtml, 108398), null, 2));
