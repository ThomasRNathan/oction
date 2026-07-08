/**
 * Copy-compliance CI guard. Scans the public marketing surface for banned
 * claims (guaranteed returns, "risque faible", "garanti par la pierre",
 * "éligible 150-0 B ter"). Fails the build on any violation.
 *
 *   pnpm tsx scripts/check-compliance.ts
 *
 * Only marketing pages/components are scanned — lib/compliance.ts (which
 * *defines* the banned patterns) and this script are excluded.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkCopy } from "../lib/compliance";

const ROOTS = [
  resolve(process.cwd(), "app/(marketing)"),
  resolve(process.cwd(), "components/marketing"),
];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.(tsx?|mdx?)$/.test(entry)) out.push(full);
  }
  return out;
}

let violations = 0;
for (const root of ROOTS) {
  let files: string[] = [];
  try {
    files = walk(root);
  } catch {
    continue; // root may not exist yet
  }
  for (const file of files) {
    const found = checkCopy(readFileSync(file, "utf8"));
    if (found.length) {
      violations += found.length;
      console.error(`✗ ${file.replace(process.cwd() + "/", "")}`);
      for (const f of found) console.error(`    “${f.match}” → ${f.label}`);
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} compliance violation(s). Aborting.`);
  process.exit(1);
}
console.log("✓ Compliance check passed — no banned claims in marketing copy.");
