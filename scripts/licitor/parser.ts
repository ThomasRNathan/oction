/**
 * Cheerio parsers for licitor.com index + detail pages.
 *
 * Index page  : ul.AdResults > li > a.Ad (+ .Location .Description .Result .PublishingDate)
 * Detail page : article.LegalAd .AdContent (+ AddressBlock Location Trusts)
 */
import * as cheerio from "cheerio";
import type { IndexListing, DetailData } from "./db";

// ─── shared helpers ────────────────────────────────────────────────────────

/** "132 000 €" → 132000. "Mise à prix : 37 000 €" → 37000. Null if unparseable. */
export function parseEuros(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/\u00a0/g, " ").match(/(\d[\d\s.,]*)\s*€/);
  if (!digits) return null;
  const cleaned = digits[1]
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // thousands-dot
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "16-04-2026" → "2026-04-16". Null if malformed. */
export function parseFrenchDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Parse the first decimal number in the description ("56,40 m²" → 56.40). */
export function parseSurface(desc: string | undefined | null): number | null {
  if (!desc) return null;
  const m = desc.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Detect occupancy keyword in free-text description. */
export function parseOccupancy(desc: string | undefined | null): string | null {
  if (!desc) return null;
  const lower = desc.toLowerCase();
  // Order matters: "inoccupé" / "libre" before "occupé" / "loué"
  // (JS regex: \b doesn't match around accented chars, so we avoid it post-accent.)
  if (/in(-| )?occup[eé]/.test(lower)) return "libre";
  if (/\blibre\b/.test(lower)) return "libre";
  if (/\blou[eé]e?\b/u.test(lower)) return "loué";
  if (/\boccup[eé]e?\b/u.test(lower)) return "occupé";
  if (/lou[eé]e?(\s|$|\n|\.)/.test(lower)) return "loué";
  if (/occup[eé]e?(\s|$|\n|\.)/.test(lower)) return "occupé";
  return null;
}

/** Extract licitor listing ID from a /annonce/.../NNNNNN.html URL. */
export function parseListicorId(url: string): number | null {
  const m = url.match(/\/(\d+)\.html/);
  return m ? parseInt(m[1], 10) : null;
}

// ─── index page ────────────────────────────────────────────────────────────

/**
 * Parse one region-historique page.
 * Returns listings + the total-page count extracted from pagination.
 */
export function parseIndexPage(
  html: string,
  region: string
): { listings: IndexListing[]; totalPages: number | null } {
  const $ = cheerio.load(html);
  const listings: IndexListing[] = [];

  // Track lot_index: same licitor_id may appear N times per page (multi-lot auction).
  const lotSeen = new Map<number, number>();

  $("ul.AdResults > li").each((_, li) => {
    const a = $(li).find("a.Ad").first();
    const href = a.attr("href");
    if (!href) return;
    const licitor_id = parseListicorId(href);
    if (!licitor_id) return;

    const lot_index = lotSeen.get(licitor_id) ?? 0;
    lotSeen.set(licitor_id, lot_index + 1);

    const title = a.attr("title") ?? "";
    const department_code = $(li).find("p.Location span.Number").first().text().trim() || null;
    const city = $(li).find("p.Location span.City").first().text().trim() || null;
    const property_type = $(li).find("p.Description span.Name").first().text().trim() || null;
    const property_description = $(li).find("p.Description span.Text").first().text().trim() || null;

    // Past auction: .Result has "DD-MM-YYYY : <span class="PriceNumber">X €</span>"
    // Upcoming:    may have different markup or empty
    const resultText = $(li).find("p.Result").first().text().trim();
    const priceText = $(li).find("p.Result span.PriceNumber").first().text().trim();
    const index_date = parseFrenchDate(resultText);
    const index_price = parseEuros(priceText);

    // Sold vs upcoming heuristic:
    //  - adjudication in title, or .Ad.Archives class → sold
    //  - no adjudication price → upcoming / unknown
    const classes = a.attr("class") ?? "";
    const isArchive = /\bArchives\b/.test(classes);
    const status: IndexListing["status"] = isArchive && index_price
      ? "sold"
      : isArchive
      ? "unknown" // on archive but no price (carence / unsold)
      : "upcoming";

    const published_raw = $(li).find("p.PublishingDate span").first().text().trim();
    // "Mercredi 4 mars" — year implied by context, skip for now
    const published_at = null;

    listings.push({
      licitor_id,
      lot_index,
      url: new URL(href, "https://www.licitor.com").toString(),
      region,
      department_code,
      city,
      property_type: property_type || extractPropertyTypeFromTitle(title),
      property_description,
      index_date,
      index_price,
      published_at,
      status,
    });
  });

  // Pagination indicator: look for "/ 3356" or a link containing ?p=LAST
  let totalPages: number | null = null;
  const pagination = $(".Pagination, .Pages, .Paginate").text();
  const mTotal = pagination.match(/\/\s*(\d{2,})/);
  if (mTotal) totalPages = parseInt(mTotal[1], 10);
  if (!totalPages) {
    // fallback: scan all ?p=N links, pick max
    let max = 0;
    $('a[href*="?p="]').each((_, el) => {
      const m = ($(el).attr("href") ?? "").match(/\?p=(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    totalPages = max || null;
  }

  return { listings, totalPages };
}

function extractPropertyTypeFromTitle(title: string): string | null {
  // "Un appartement, Villiers-sur-Marne, Val-de-Marne, adjudication..." → "Un appartement"
  const parts = title.split(",");
  return parts[0]?.trim() || null;
}

// ─── detail page ───────────────────────────────────────────────────────────

export function parseDetailPage(html: string, licitor_id: number): DetailData {
  const $ = cheerio.load(html);
  const ad = $(".AdContent").first();

  const tribunal = ad.find("p.Court").first().text().replace(/\s+/g, " ").trim() || null;

  // Auction date: <p class="Date"><time datetime="2026-04-16T09:30:00">...</time></p>
  const auctionIso =
    ad.find("p.Date time").first().attr("datetime") ??
    null;

  // AddressBlock structure:
  //   div.Lot > div.SousLot > h2 (type), p (description multiline)
  //   h3 "Adjudication : X €"  or  h3 "Mise à prix : X €"
  //   h4 "(Mise à prix : X €)" when sold
  const sousLot = ad.find(".SousLot").first();
  const property_type = sousLot.find("h2").first().text().trim() || null;
  const descRaw = sousLot.find("p").first();
  // Replace <br> with \n before reading text, so multiline descriptions are intact
  descRaw.find("br").replaceWith("\n");
  const property_description = descRaw.text().trim() || null;

  const surface = parseSurface(property_description);
  const surfaceAnnexeMatch = property_description?.match(
    /(\d+(?:[.,]\d+)?)\s*m[²2]\s*(?:de\s+surface\s+annexe|annexe)/i
  );
  const surface_annexe = surfaceAnnexeMatch
    ? parseFloat(surfaceAnnexeMatch[1].replace(",", "."))
    : null;
  const occupancy = parseOccupancy(property_description);

  // Floor: "au 1er étage" / "au rez-de-chaussée"
  const floorMatch = property_description?.match(
    /au\s+(rez-de-chauss[ée]e|\d+(?:er|ème|e)?\s*[ée]tage)/i
  );
  const floor = floorMatch ? floorMatch[1].trim() : null;

  // Prices
  const allH = sousLot.parent().find("h3, h4");
  let mise_a_prix: number | null = null;
  let adjudication_price: number | null = null;
  allH.each((_, el) => {
    const txt = $(el).text();
    if (/Adjudication/i.test(txt)) adjudication_price = parseEuros(txt);
    else if (/Mise\s*[àa]\s*prix/i.test(txt)) mise_a_prix = parseEuros(txt);
  });

  // Location
  const city = ad.find(".Location p.City").first().text().replace(/\s+/g, " ").trim() || null;
  const streetEl = ad.find(".Location p.Street").first();
  streetEl.find("br").replaceWith(", ");
  const address = streetEl.text().replace(/\s+/g, " ").replace(/,\s*,/g, ",").trim() || null;

  // Lat/Lon from Google Maps href
  const mapsHref = ad.find(".Location .Map a").first().attr("href") ?? "";
  const coordMatch = mapsHref.match(/q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const lat = coordMatch ? parseFloat(coordMatch[1]) : null;
  const lon = coordMatch ? parseFloat(coordMatch[2]) : null;

  // Visit date (pre-auction only)
  const visit_date = ad.find(".Location p.Visits").first().text().replace(/^Visite\s*sur\s*place\s*/i, "").trim() || null;

  // Lawyer — first <div class="Trust"> is the poursuivant
  const firstTrust = ad.find(".Trusts .Trust").first();
  const lawyerH3 = firstTrust.find("h3").first().text().trim() || null;
  const lawyerP = firstTrust.find("p").first();
  lawyerP.find("br").replaceWith("\n");
  const lawyerPText = lawyerP.text().trim() || null;

  // "Maître Harry Orhon, Avocat"  |  "Maître Vincent Rieu, du Cabinet Doria Avocats, Avocat associé"
  let lawyer_name: string | null = null;
  let lawyer_firm: string | null = null;
  if (lawyerH3) {
    const nameMatch = lawyerH3.match(/Ma[îi]tre\s+([^,]+)/);
    lawyer_name = nameMatch ? nameMatch[1].trim() : lawyerH3;
    const firmMatch = lawyerH3.match(/du\s+(?:Cabinet|cabinet)\s+([^,]+)|de\s+la\s+(SCP|SELARL|SELAS|SARL)\s+([^,]+)/);
    if (firmMatch) lawyer_firm = (firmMatch[1] ?? `${firmMatch[2]} ${firmMatch[3]}`).trim();
  }

  // Published date: <p class="PublishingDate">Annonce publiée le <time datetime="2026-03-04...">...</time></p>
  const pubIso = ad.find("p.PublishingDate time").first().attr("datetime") ?? null;
  const published_at = pubIso ? pubIso.slice(0, 10) : null;

  // Status
  let status: DetailData["status"] = "unknown";
  if (adjudication_price && adjudication_price > 0) status = "sold";
  else if (auctionIso) {
    const auctionMs = Date.parse(auctionIso);
    status = Number.isFinite(auctionMs) && auctionMs > Date.now() ? "upcoming" : "unsold";
  }

  return {
    licitor_id,
    tribunal,
    auction_date: auctionIso,
    property_type,
    property_description,
    surface,
    surface_annexe,
    occupancy,
    floor,
    city,
    address,
    lat,
    lon,
    mise_a_prix,
    adjudication_price,
    visit_date,
    lawyer_name,
    lawyer_firm,
    lawyer_address: lawyerPText,
    published_at,
    status,
    raw_html: null, // caller decides whether to persist raw HTML
  };
}
