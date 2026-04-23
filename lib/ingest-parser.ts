/**
 * Parses the HTML a user has already loaded in their browser when visiting a
 * licitor.com detail page. Pure function: takes a URL + HTML string, returns
 * structured data. No network requests. Used by /api/ingest-licitor.
 */
import * as cheerio from "cheerio";

export interface IngestedListing {
  licitor_id: number;
  url: string;
  // shared fields (apply to all lots of this announcement)
  tribunal: string | null;
  auction_date: string | null;      // ISO 8601 with Europe/Paris tz
  adjudication_date: string | null; // YYYY-MM-DD
  visit_date: string | null;        // raw French text, kept as-is
  lawyer_name: string | null;
  lawyer_firm: string | null;
  lawyer_address: string | null;
  // per-lot fields (apply to lot_index=0)
  property_type: string | null;
  property_description: string | null;
  surface: number | null;
  surface_annexe: number | null;
  occupancy: string | null;
  floor: string | null;
  city: string | null;
  address: string | null;
  mise_a_prix: number | null;
  adjudication_price: number | null;
  status: "sold" | "upcoming" | "unsold" | "unknown";
  warnings: string[];
}

const MONTHS_FR: Record<string, number> = {
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5,
  juin: 6, juillet: 7, "août": 8, aout: 8, septembre: 9,
  octobre: 10, novembre: 11, "décembre": 12, decembre: 12,
};

/** Parse French-formatted euro amount: "132 000 €" or "8 569,19 €" or "132000". */
function parseEuros(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\u00a0/g, " ")
    .replace(/€|EUR|euros?/gi, "")
    .trim();
  // Strip thin spaces / normal spaces used as thousand separators.
  const noSpaces = cleaned.replace(/\s+/g, "");
  // Handle both "," and "." as decimal separator, but "." can also be thousand-sep.
  // If string contains both, "." is thousand-sep and "," is decimal.
  let normalized: string;
  if (noSpaces.includes(",") && noSpaces.includes(".")) {
    normalized = noSpaces.replace(/\./g, "").replace(",", ".");
  } else if (noSpaces.includes(",")) {
    normalized = noSpaces.replace(",", ".");
  } else {
    normalized = noSpaces;
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function frDateToISO(day: string, month: string, year: string): string | null {
  const m = MONTHS_FR[month.toLowerCase()];
  if (!m) return null;
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);
  if (!d || !y) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Combine ISO date + French hour text "14h30" / "14h" / "14:30" → ISO datetime. */
function composeISODateTime(
  isoDate: string,
  hour: string,
  minute: string | undefined
): string {
  const h = hour.padStart(2, "0");
  const mm = (minute || "00").padStart(2, "0");
  // Europe/Paris is +01:00 in winter, +02:00 in summer. Using +01:00 as a
  // best-effort approximation — good enough for our sort/filter use cases.
  return `${isoDate}T${h}:${mm}:00+01:00`;
}

export function parseLicitorHtml(
  url: string,
  html: string
): IngestedListing | null {
  const idMatch = url.match(/\/(\d+)\.html/);
  const licitor_id = idMatch ? parseInt(idMatch[1], 10) : NaN;
  if (!Number.isFinite(licitor_id)) return null;

  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ");
  const warnings: string[] = [];

  // ── Adjudication price (post-auction — the key target field) ─────────────
  // Shapes we've seen on licitor:
  //   "adjugé le 15 mars 2024 pour 250 000 €"
  //   "adjugée à 132 000 €"
  //   "Prix d'adjudication : 250 000 €"
  let adjudication_price: number | null = null;
  const adjMatchers = [
    /adjug[ée]e?\s+(?:le\s+\d{1,2}\s+[\wàâéèêëîïôöùûüÿç]+\s+\d{4}\s+)?(?:pour\s+|à\s+|au\s+prix\s+de\s+)([\d\s.,\u00a0]+)\s*(?:€|EUR|euros?)/i,
    /prix\s+d['']\s*adjudication[^:]*[:\s]+([\d\s.,\u00a0]+)\s*(?:€|EUR|euros?)/i,
    /vendu\s+(?:pour|à)\s+([\d\s.,\u00a0]+)\s*(?:€|EUR|euros?)/i,
  ];
  for (const re of adjMatchers) {
    const m = bodyText.match(re);
    if (m) {
      const n = parseEuros(m[1]);
      if (n) { adjudication_price = n; break; }
    }
  }

  // ── Adjudication date (when the sale happened) ────────────────────────────
  let adjudication_date: string | null = null;
  const adjDateMatch = bodyText.match(
    /adjug[ée]e?\s+le\s+(\d{1,2})\s+([\wàâéèêëîïôöùûüÿç]+)\s+(\d{4})/i
  );
  if (adjDateMatch) {
    adjudication_date = frDateToISO(adjDateMatch[1], adjDateMatch[2], adjDateMatch[3]);
  }

  // ── Auction date (scheduled hearing) ──────────────────────────────────────
  let auction_date: string | null = null;
  const auctionMatch = bodyText.match(
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([\wàâéèêëîïôöùûüÿç]+)\s+(\d{4})(?:\s+[àa]\s+(\d{1,2})\s*[hH:]\s*(\d{0,2}))?/i
  );
  if (auctionMatch) {
    const iso = frDateToISO(auctionMatch[1], auctionMatch[2], auctionMatch[3]);
    if (iso) {
      auction_date = auctionMatch[4]
        ? composeISODateTime(iso, auctionMatch[4], auctionMatch[5])
        : `${iso}T00:00:00+01:00`;
    }
  }

  // ── Mise à prix ───────────────────────────────────────────────────────────
  let mise_a_prix: number | null = null;
  const mapMatchers = [
    /mise\s*[àa]\s*prix\s*:?\s*([\d\s.,\u00a0]+)\s*(?:€|EUR|euros?)/i,
    /([\d\s.,\u00a0]+)\s*(?:€|EUR|euros?)\s*(?:de\s+)?mise\s*[àa]\s*prix/i,
  ];
  for (const re of mapMatchers) {
    const m = bodyText.match(re);
    if (m) {
      const n = parseEuros(m[1]);
      if (n) { mise_a_prix = n; break; }
    }
  }
  if (!mise_a_prix) warnings.push("Mise à prix non trouvée");

  // ── Surface ───────────────────────────────────────────────────────────────
  let surface: number | null = null;
  const surfMatch = bodyText.match(
    /(\d+(?:[,.]\d+)?)\s*m[²2](?!\s*de\s+terrain)/i
  ) || bodyText.match(/Carrez[:\s]+(\d+(?:[,.]\d+)?)/i);
  if (surfMatch) surface = parseFloat(surfMatch[1].replace(",", "."));

  // ── Property type ─────────────────────────────────────────────────────────
  let property_type: string | null = null;
  const typeMatch = bodyText.match(
    /(?:un|une|des|l[e'])\s+(appartement|maison|local|terrain|immeuble|parking|cave|bureau|lot)/i
  );
  if (typeMatch) {
    property_type = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase();
  }

  // ── Occupancy ─────────────────────────────────────────────────────────────
  let occupancy: string | null = null;
  if (/\b(?:libre|inoccup[ée]e?|non\s*occup[ée]e?)\b/i.test(bodyText)) {
    occupancy = "Libre";
  } else if (/\blou[ée]e?\b/i.test(bodyText)) {
    occupancy = "Loué";
  } else if (/\boccup[ée]e?\b/i.test(bodyText)) {
    occupancy = "Occupé";
  }

  // ── Tribunal ──────────────────────────────────────────────────────────────
  let tribunal: string | null = null;
  const tribMatch = bodyText.match(
    /Tribunal\s+(?:Judiciaire|de\s+Grande\s+Instance)\s+de\s+([A-ZÀ-ÿ][\wÀ-ÿ-]{2,}(?:[\s-][A-ZÀ-ÿ][\wÀ-ÿ-]+)*)/
  );
  if (tribMatch) tribunal = `Tribunal Judiciaire de ${tribMatch[1].trim()}`;

  // ── Visit date (kept as raw text — downstream attractiveness parses it) ──
  let visit_date: string | null = null;
  const visitMatch = bodyText.match(
    /visite[\w\s]*?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}\s+[\wàâéèêëîïôöùûüÿç]+\s+\d{4}(?:\s+de\s+\d{1,2}[hH]\d{0,2}\s+[àa]\s+\d{1,2}[hH]\d{0,2})?/i
  );
  if (visitMatch) visit_date = visitMatch[0].trim().substring(0, 120);

  // ── Lawyer (poursuivant) ──────────────────────────────────────────────────
  let lawyer_name: string | null = null;
  const lawMatch = bodyText.match(
    /Ma[iî]tre\s+([A-ZÀ-ÿ][\wÀ-ÿ\s-]{1,40}?)(?:,|\s+Avocat|\s+avocat|\s+au\s+Barreau|\s+SCP|\s+SELARL)/
  );
  if (lawMatch) lawyer_name = "Me " + lawMatch[1].trim();

  let lawyer_firm: string | null = null;
  const firmMatch = bodyText.match(/\b(SCP|SELARL|SELAS|AARPI)\s+([\wÀ-ÿ\s&,-]{3,60}?)(?:,|\s+Avocats?|\s+\d{1,4}\b)/);
  if (firmMatch) lawyer_firm = `${firmMatch[1]} ${firmMatch[2].trim()}`;

  // ── City / address ────────────────────────────────────────────────────────
  let city: string | null = null;
  const arrMatch = bodyText.match(/Paris\s*(\d{1,2})\s*[eèé]/i);
  if (arrMatch) city = `Paris ${parseInt(arrMatch[1], 10)}e`;

  let address: string | null = null;
  const addrRe =
    /\b(\d{1,4}(?:\s*(?:bis|ter))?\s*,?\s*(?:rue|avenue|boulevard|bd|place|square|impasse|passage|all[ée]e|quai|chemin|cours|faubourg|rond[\s-]point)[\s']+[\wàâéèêëîïôöùûüÿç'\-]+(?:\s+[\wàâéèêëîïôöùûüÿç'\-]+){0,5})/gi;
  const addrMatches = Array.from(bodyText.matchAll(addrRe));
  for (const m of addrMatches) {
    const idx = m.index ?? 0;
    const ctx = bodyText.slice(Math.max(0, idx - 50), idx);
    // skip lawyer office addresses
    if (!/Ma[iî]tre|Avocat|Barreau|SCP|SELARL/i.test(ctx)) {
      address = m[1].trim().replace(/\s+/g, " ").substring(0, 160);
      break;
    }
  }

  // ── Property description ──────────────────────────────────────────────────
  let property_description: string | null = null;
  const descMatchers = [/consistant\s+en[^.]+\./i, /comprenant[^.]+\./i, /composé[^.]+\./i];
  for (const re of descMatchers) {
    const m = bodyText.match(re);
    if (m) { property_description = m[0].trim().substring(0, 300); break; }
  }

  // ── Status inference ──────────────────────────────────────────────────────
  let status: IngestedListing["status"] = "unknown";
  if (adjudication_price != null) {
    status = "sold";
  } else if (auction_date) {
    const t = Date.parse(auction_date);
    if (Number.isFinite(t)) {
      status = t < Date.now() - 86_400_000 ? "unsold" : "upcoming";
    }
  }

  return {
    licitor_id,
    url,
    tribunal,
    auction_date,
    adjudication_date,
    visit_date,
    lawyer_name,
    lawyer_firm,
    lawyer_address: null, // extracted inline into lawyer_firm; left null for now
    property_type,
    property_description,
    surface,
    surface_annexe: null,
    occupancy,
    floor: null,
    city,
    address,
    mise_a_prix,
    adjudication_price,
    status,
    warnings,
  };
}
