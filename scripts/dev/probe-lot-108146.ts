/**
 * One-shot probe: confirm the scraper now extracts `Studio` (not `Lot`) for
 * the Paris 18ème studio reported in the DVF-indisponible bug. Run with:
 *
 *   pnpm tsx scripts/dev/probe-lot-108146.ts
 */
import { scrapeListicor } from "@/lib/scraper";

const URL =
  "https://www.licitor.com/annonce/10/81/46/vente-aux-encheres/un-studio/paris-18eme/paris/108146.html?print=1";

(async () => {
  const r = await scrapeListicor(URL);
  console.log(
    JSON.stringify(
      {
        type: r.type,
        nUnits: r.nUnits,
        surface: r.surface,
        arrondissement: r.arrondissement,
        city: r.city,
        address: r.address,
      },
      null,
      2,
    ),
  );
  if (r.type !== "Studio") {
    console.error(`FAIL — expected type=Studio, got type=${r.type}`);
    process.exit(1);
  }
  console.log("OK");
})();
