import * as cheerio from "cheerio";
import { PropertyData } from "./types";

/**
 * Live-page scraper used by /api/analyze.
 *
 * Uses `?print=1` and reads the structured DOM (same selectors as the DB
 * scraper in scripts/licitor/parser.ts). Bodytext-regex was previously the
 * primary path, which conflated the lawyer's office with the property
 * address. The DOM is unambiguous: `.AdContent .Location p.Street/p.City`
 * is the property, `.AdContent .Trusts .Trust p` is the lawyer.
 *
 * Bodytext fallbacks remain for the few fields where the DOM markup varies
 * across listings (or is missing entirely on legacy templates).
 */

// French ordinals 1..30 covering the typical multi-lot announcement headers
// ("Dix parkings", "Vingt-cinq emplacements", "Trente caves", …).
const FRENCH_ORDINALS: Record<string, number> = {
  un: 1, une: 1,
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
  seize: 16,
  "dix-sept": 17, "dix-huit": 18, "dix-neuf": 19,
  vingt: 20,
  "vingt-et-un": 21, "vingt-deux": 22, "vingt-trois": 23, "vingt-quatre": 24,
  "vingt-cinq": 25, "vingt-six": 26, "vingt-sept": 27, "vingt-huit": 28,
  "vingt-neuf": 29,
  trente: 30,
};

/** Match a leading French ordinal (or arabic digit) at the start of a type string. */
function parseLeadingCount(typeRaw: string): number | null {
  if (!typeRaw) return null;
  // "Lot de 10 parkings", "10 parkings" → 10
  const digit = typeRaw.match(/^\s*(?:lot\s+de\s+)?(\d{1,3})\s+/i);
  if (digit) return parseInt(digit[1], 10);
  // Split into individual words. "Vingt et un" preserves "et" as its own
  // token via the `et` → `-et-` substitution so "vingt-et-un" can match.
  const tokens = typeRaw
    .toLowerCase()
    .replace(/\s+et\s+/g, "-et-")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;
  // Compound ordinals: "vingt-et-un" (3 tokens), "dix-sept" (2 tokens).
  if (tokens.length >= 3) {
    const triple = `${tokens[0]}-${tokens[1]}-${tokens[2]}`;
    if (FRENCH_ORDINALS[triple] !== undefined) return FRENCH_ORDINALS[triple];
  }
  if (tokens.length >= 2) {
    const pair = `${tokens[0]}-${tokens[1]}`;
    if (FRENCH_ORDINALS[pair] !== undefined) return FRENCH_ORDINALS[pair];
  }
  if (FRENCH_ORDINALS[tokens[0]] !== undefined) return FRENCH_ORDINALS[tokens[0]];
  return null;
}

/** "Tribunal Judiciaire de Versailles\t\t (Yvelines)" → "Tribunal Judiciaire de Versailles" */
function cleanTribunal(raw: string): string | undefined {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  // Drop trailing parenthetical department info.
  return trimmed.replace(/\s*\([^)]+\)\s*$/, "").trim() || undefined;
}

/** Extract a city slug from the canonical /annonce/.../{city}/{dept}/NNNNNN.html URL. */
function cityFromUrl(url: string): string | undefined {
  const m = url.match(/\/vente-aux-encheres\/[^/]+\/([^/]+)\/[^/]+\/\d+\.html/);
  if (!m) return undefined;
  return m[1]
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join("-");
}

export async function scrapeListicor(url: string): Promise<PropertyData> {
  // Ensure print version for cleaner HTML.
  const printUrl = url.includes("print=1")
    ? url
    : url + (url.includes("?") ? "&print=1" : "?print=1");

  const response = await fetch(printUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch listing: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const ad = $(".AdContent").first();
  const adExists = ad.length > 0;

  const warnings: string[] = [];
  const bodyText = $("body").text().replace(/\s+/g, " ");

  // ID from URL.
  const idMatch = url.match(/\/(\d+)\.html/);
  const id = idMatch?.[1];

  // ── Property type + n_units ──────────────────────────────────────────────
  // DOM: `.SousLot h2` is the canonical type ("Dix parkings", "Un appartement").
  // Fallback: bodytext regex like the legacy implementation.
  const sousLot = ad.find(".SousLot").first();
  const typeRaw = sousLot.find("h2").first().text().trim();
  let type: string | undefined;
  let nUnits: number | undefined;
  if (typeRaw) {
    nUnits = parseLeadingCount(typeRaw) ?? undefined;
    // Single-word noun extracted: parking, appartement, maison, …
    const tNoun = typeRaw
      .toLowerCase()
      .match(
        /(appartement|maison|local|terrain|immeuble|parking|emplacement|cave|garage|box|bureau|lot)/
      );
    if (tNoun) {
      type = tNoun[1].charAt(0).toUpperCase() + tNoun[1].slice(1);
    }
  }
  if (!type) {
    const m = bodyText.match(
      /(?:un|une|des|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|trente)\s+(appartement|maison|local|terrain|immeuble|parking|emplacement|cave|garage|box|bureau|lot)/i
    );
    if (m) {
      type = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    }
  }
  if (!nUnits && type) {
    // "Un appartement" → 1, even when typeRaw was empty/legacy.
    nUnits = 1;
  }

  // ── City + address (DOM-first, lawyer-aware) ─────────────────────────────
  // DOM: property city/address come from `.Location p.City` / `p.Street`.
  // Lawyer office sits under `.Trusts .Trust p` and is NOT mixed in here.
  const loc = ad.find(".Location").first();
  let city: string | undefined =
    loc.find("p.City").first().text().replace(/\s+/g, " ").trim() || undefined;
  const streetEl = loc.find("p.Street").first();
  streetEl.find("br").replaceWith(", ");
  let address: string | undefined =
    streetEl.text().replace(/\s+/g, " ").replace(/,\s*,/g, ",").trim() ||
    undefined;

  // URL-slug fallback (e.g. when the .Location block is absent on legacy
  // templates). We don't fall back to bodytext for city/address — the DOM
  // failure mode used to be the *bug*, not the fix.
  if (!city) city = cityFromUrl(url);

  // ── Arrondissement (Paris-specific) ──────────────────────────────────────
  let arrondissement: number | undefined;
  // Prefer the City field: "Paris (08)" / "Paris 8e" / "Paris 8ème".
  const cityArrMatch =
    city?.match(/Paris\s*\((\d{1,2})\)/) ??
    city?.match(/Paris\s*(\d{1,2})\s*[eèé]?/i);
  if (cityArrMatch) {
    arrondissement = parseInt(cityArrMatch[1], 10);
  } else if (city?.toLowerCase() === "paris") {
    // City is "Paris" with no number — try address ZIP "750NN".
    const zipMatch = address?.match(/750(\d{2})/);
    if (zipMatch) arrondissement = parseInt(zipMatch[1], 10);
  }

  // ── Tribunal ─────────────────────────────────────────────────────────────
  let tribunal: string | undefined;
  const courtRaw = ad.find("p.Court").first().text();
  if (courtRaw) {
    tribunal = cleanTribunal(courtRaw);
  }
  if (!tribunal) {
    // Bodytext fallback (legacy templates).
    const m = bodyText.match(
      /Tribunal\s+(?:Judiciaire|de\s+Grande\s+Instance)\s+de\s+([A-ZÀ-Ÿ][\wÀ-ÿ-]{2,})/
    );
    if (m) tribunal = `Tribunal Judiciaire de ${m[1].trim()}`;
  }

  // ── Auction date ─────────────────────────────────────────────────────────
  // DOM: <p class="Date"><time datetime="2026-07-01T09:30:00">…</time></p>
  let auctionDate: string | undefined;
  const auctionIso = ad.find("p.Date time").first().attr("datetime");
  if (auctionIso) {
    auctionDate = auctionIso;
  } else {
    const m = bodyText.match(
      /(lundi|mardi|mercredi|jeudi|vendredi|samedi)\s+(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\s+[àa]\s+(\d{1,2})\s*[hH:]\s*(\d{2})?/i
    );
    if (m) auctionDate = m[0].trim();
  }

  // ── Visit date ───────────────────────────────────────────────────────────
  let visitDate: string | undefined;
  const visitsText = loc
    .find("p.Visits")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .replace(/^Visite\s*sur\s*place\s*/i, "Visites sur place ")
    .trim();
  if (visitsText) {
    visitDate = visitsText.substring(0, 160);
  } else {
    const m = bodyText.match(
      /visite[\w\s]*?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})(?:\s+de\s+\d{1,2}[hH]\d{0,2}\s+[àa]\s+\d{1,2}[hH]\d{0,2})?/i
    );
    if (m) visitDate = m[0].trim().substring(0, 160);
  }

  // ── Description (multiline) ──────────────────────────────────────────────
  let description: string | undefined;
  const descEl = sousLot.find("p").first();
  if (descEl.length > 0) {
    descEl.find("br").replaceWith("\n");
    description = descEl.text().trim().substring(0, 600) || undefined;
  }
  if (!description) {
    for (const pattern of [
      /consistant\s+en[^.]+\./i,
      /comprenant[^.]+\./i,
      /composé[^.]+\./i,
    ]) {
      const m = bodyText.match(pattern);
      if (m) {
        description = m[0].trim().substring(0, 300);
        break;
      }
    }
  }

  // ── Surface ──────────────────────────────────────────────────────────────
  let surface: number | undefined;
  // Try description first (most reliable on print page).
  if (description) {
    const m = description.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/);
    if (m) surface = parseFloat(m[1].replace(",", "."));
  }
  if (!surface) {
    for (const pattern of [
      /(\d+[,\.]\d+)\s*m[²2]/,
      /(\d+)\s*m[²2]/,
      /surface[:\s]+(\d+[,\.]\d+)/i,
      /Carrez[:\s]+(\d+[,\.]\d+)/i,
    ]) {
      const m = bodyText.match(pattern);
      if (m) {
        surface = parseFloat(m[1].replace(",", "."));
        break;
      }
    }
  }
  if (!surface && type !== "Parking" && type !== "Cave" && type !== "Box" &&
      type !== "Garage" && type !== "Emplacement" && type !== "Terrain") {
    // Surface is genuinely missing only for non-parking/non-terrain types.
    // For parking we don't expect a surface.
    warnings.push("Surface non trouvée");
  }

  // ── Mise à prix ──────────────────────────────────────────────────────────
  // DOM: any `h3` or `h4` under `.AdContent` with "Mise à prix".
  let miseAPrix: number | undefined;
  ad.find("h3, h4").each((_, el) => {
    const txt = $(el).text();
    if (/Mise\s*[àa]\s*prix/i.test(txt) && !miseAPrix) {
      const m = txt.replace(/\u00a0/g, " ").match(/(\d[\d\s.,]*)\s*€/);
      if (m) {
        const cleaned = m[1].replace(/\s/g, "").replace(",", ".");
        const n = parseInt(cleaned, 10);
        if (Number.isFinite(n) && n > 0) miseAPrix = n;
      }
    }
  });
  if (!miseAPrix) {
    for (const pattern of [
      /mise\s*[àa]\s*prix\s*:?\s*([\d\s\.]+)\s*(?:€|EUR|euros?)/i,
      /mise\s*[àa]\s*prix\s*:?\s*([\d\s\.]+)/i,
      /([\d\s\.]+)\s*(?:€|EUR|euros?)\s*(?:de\s+)?mise\s*[àa]\s*prix/i,
    ]) {
      const m = bodyText.match(pattern);
      if (m) {
        const n = parseInt(m[1].replace(/[\s\.]/g, ""), 10);
        if (Number.isFinite(n) && n > 0) {
          miseAPrix = n;
          break;
        }
      }
    }
  }
  if (!miseAPrix) warnings.push("Mise à prix non trouvée");

  // ── Rooms ────────────────────────────────────────────────────────────────
  let rooms: string | undefined;
  const roomsMatch = (description ?? bodyText).match(
    /(\d+)\s*pi[èe]ce(?:s?\s*principal)?/i
  );
  if (roomsMatch) rooms = roomsMatch[0].trim();

  // ── Floor ────────────────────────────────────────────────────────────────
  let floor: string | undefined;
  const floorMatch = (description ?? bodyText).match(
    /au\s+(rez-de-chauss[ée]e|\d+(?:er|ème|e)?\s*[ée]tage)/i
  );
  if (floorMatch) floor = floorMatch[1].trim();

  // ── Occupancy ────────────────────────────────────────────────────────────
  let occupancy: string | undefined;
  const occText = (description ?? bodyText).toLowerCase();
  if (/in(-| )?occup[eé]|\blibre\b|non\s*occup/.test(occText)) {
    occupancy = "Libre";
  } else if (/\blou[eé]e?\b|\boccup[eé]e?\b/.test(occText)) {
    occupancy = "Occupé";
  }

  // ── Lawyer (h3 — name & firm) and lawyer office address (p in same Trust) ─
  let lawyer: string | undefined;
  let lawyerPhone: string | undefined;
  let lawyerAddress: string | undefined;
  const trust = ad.find(".Trusts .Trust").first();
  if (trust.length > 0) {
    const h3 = trust.find("h3").first().text().trim();
    if (h3) {
      // "Maître François Perrault, membre de la SELARL Mayet - Perrault, Avocat"
      const nameMatch = h3.match(/Ma[îi]tre\s+([^,]+)/);
      lawyer = nameMatch ? "Me " + nameMatch[1].trim() : h3;
    }
    const pEl = trust.find("p").first();
    pEl.find("br").replaceWith("\n");
    const pText = pEl.text().replace(/\s+/g, " ").trim();
    if (pText) {
      // "16, rue André Chénier - 78000 Versailles  Tél.: 01 39 20 36 90"
      const phoneMatch = pText.match(
        /(?:T[ée]l\.?\s*:?\s*)?(\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2})/
      );
      if (phoneMatch) lawyerPhone = phoneMatch[1];
      // Strip the phone prefix to keep only the address.
      lawyerAddress = pText
        .replace(/T[ée]l\.?\s*:?\s*\d[\d\s.]+/i, "")
        .replace(/\s+/g, " ")
        .trim() || undefined;
    }
  }
  if (!lawyer) {
    const m = bodyText.match(
      /Ma[iî]tre\s+([\w\s-]+?)(?:,|\s+Avocat|\s+avocat|\s+au\s+Barreau)/i
    );
    if (m) lawyer = "Me " + m[1].trim();
  }
  if (!lawyerPhone) {
    const m = bodyText.match(/(\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2})/);
    if (m) lawyerPhone = m[1];
  }

  if (!adExists) {
    // No structured DOM: all extraction came from bodytext fallbacks.
    // Surface this so the caller knows reliability is degraded.
    warnings.push("Markup non-structuré — extraction par fallback regex");
  }

  return {
    id,
    type,
    nUnits,
    address,
    city,
    arrondissement,
    surface,
    rooms,
    floor,
    occupancy,
    description,
    miseAPrix,
    auctionDate,
    tribunal,
    visitDate,
    lawyer,
    lawyerPhone,
    lawyerAddress,
    warnings,
  };
}
