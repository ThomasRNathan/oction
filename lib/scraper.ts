import * as cheerio from "cheerio";
import { PropertyData } from "./types";

export async function scrapeListicor(url: string): Promise<PropertyData> {
  // Ensure print version for cleaner HTML
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
  const warnings: string[] = [];

  const bodyText = $("body").text().replace(/\s+/g, " ");

  // Extract ID from URL
  const idMatch = url.match(/\/(\d+)\.html/);
  const id = idMatch?.[1];

  // Property type
  const typePatterns = [
    /(?:un|une|des)\s+(appartement|maison|local|terrain|immeuble|parking|cave|bureau|lot)/i,
  ];
  let type: string | undefined;
  for (const pattern of typePatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      type = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      break;
    }
  }

  // Arrondissement
  let arrondissement: number | undefined;
  const arrMatch = bodyText.match(
    /Paris\s*(\d{1,2})\s*[eèé]/i
  );
  if (arrMatch) {
    arrondissement = parseInt(arrMatch[1], 10);
  }

  // City
  let city = "Paris";
  const cityMatch = bodyText.match(
    /(?:Tribunal\s+Judiciaire\s+de\s+)(\w[\w\s-]*)/i
  );
  if (cityMatch) {
    // Keep Paris as default, but could extract from other patterns
  }

  // Address - look for street pattern, but skip lawyer's office
  let address: string | undefined;
  // Use a stricter regex that matches only short, compact address patterns
  const addrRegex =
    /\b(\d{1,4}(?:\s*(?:bis|ter))?\s*,?\s*(?:rue|avenue|boulevard|bd|place|square|impasse|passage|all[ée]e|quai|chemin|cours|faubourg|rond[\s-]point)[\s']+[\wàâéèêëîïôöùûüÿç'\-]+(?:\s+[\wàâéèêëîïôöùûüÿç'\-]+){0,5})/gi;
  const matches = Array.from(bodyText.matchAll(addrRegex));
  // Filter out lawyer office addresses (typically near "Maître" or phone numbers)
  for (const m of matches) {
    const idx = m.index || 0;
    const contextBefore = bodyText.slice(Math.max(0, idx - 50), idx);
    if (!/Ma[iî]tre|Avocat|Breguet/i.test(contextBefore)) {
      address = m[1].trim().replace(/\s+/g, " ").substring(0, 120);
      break;
    }
  }

  // Surface area
  let surface: number | undefined;
  const surfacePatterns = [
    /(\d+[,\.]\d+)\s*m[²2]/,
    /(\d+)\s*m[²2]/,
    /surface[:\s]+(\d+[,\.]\d+)/i,
    /Carrez[:\s]+(\d+[,\.]\d+)/i,
  ];
  for (const pattern of surfacePatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      surface = parseFloat(match[1].replace(",", "."));
      break;
    }
  }
  if (!surface) warnings.push("Surface non trouvée");

  // Mise à prix
  let miseAPrix: number | undefined;
  const prixPatterns = [
    /mise\s*[àa]\s*prix\s*:?\s*([\d\s\.]+)\s*(?:€|EUR|euros?)/i,
    /mise\s*[àa]\s*prix\s*:?\s*([\d\s\.]+)/i,
    /([\d\s\.]+)\s*(?:€|EUR|euros?)\s*(?:de\s+)?mise\s*[àa]\s*prix/i,
  ];
  for (const pattern of prixPatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      miseAPrix = parseInt(match[1].replace(/[\s\.]/g, ""), 10);
      if (miseAPrix > 0) break;
    }
  }
  if (!miseAPrix) warnings.push("Mise à prix non trouvée");

  // Auction date
  let auctionDate: string | undefined;
  const dateMatch = bodyText.match(
    /(lundi|mardi|mercredi|jeudi|vendredi|samedi)\s+(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\s+[àa]\s+(\d{1,2})\s*[hH:]\s*(\d{2})?/i
  );
  if (dateMatch) {
    auctionDate = dateMatch[0].trim();
  }

  // Tribunal
  let tribunal: string | undefined;
  const tribunalMatch = bodyText.match(
    /Tribunal\s+(?:Judiciaire|de\s+Grande\s+Instance)\s+de\s+(Paris|Lyon|Marseille|Bordeaux|Lille|Nantes|Toulouse|Nice|Rennes|Strasbourg|Montpellier|Grenoble|[A-ZÀ-Ÿ][\wÀ-ÿ-]{2,})/
  );
  if (tribunalMatch) {
    tribunal = `Tribunal Judiciaire de ${tribunalMatch[1].trim()}`;
  }

  // Visit date — handles "Visite sur place", "Visite :", "visite le", etc.
  let visitDate: string | undefined;
  const visitMatch = bodyText.match(
    /visite[\w\s]*?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})(?:\s+de\s+\d{1,2}[hH]\d{0,2}\s+[àa]\s+\d{1,2}[hH]\d{0,2})?/i
  );
  if (visitMatch) {
    visitDate = visitMatch[0].trim().substring(0, 80);
  }

  // Rooms / description
  let rooms: string | undefined;
  const roomsMatch = bodyText.match(
    /(\d+)\s*pi[èe]ce(?:s?\s*principal)/i
  );
  if (roomsMatch) {
    rooms = roomsMatch[0].trim();
  }

  // Occupancy - check "libre/inoccupée" BEFORE "occupée" (substring conflict)
  let occupancy: string | undefined;
  if (/libre|inoccup[ée]|non\s*occup/i.test(bodyText)) {
    occupancy = "Libre";
  } else if (/occup[ée]/i.test(bodyText)) {
    occupancy = "Occupé";
  }

  // Lawyer
  let lawyer: string | undefined;
  const lawyerMatch = bodyText.match(
    /Ma[iî]tre\s+([\w\s-]+?)(?:,|\s+Avocat|\s+avocat|\s+au\s+Barreau)/i
  );
  if (lawyerMatch) {
    lawyer = "Me " + lawyerMatch[1].trim();
  }

  // Lawyer phone
  let lawyerPhone: string | undefined;
  const phoneMatch = bodyText.match(
    /(\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2})/
  );
  if (phoneMatch) {
    lawyerPhone = phoneMatch[1];
  }

  // Description - get a chunk of text around key descriptors
  let description: string | undefined;
  const descPatterns = [
    /consistant\s+en[^.]+\./i,
    /comprenant[^.]+\./i,
    /composé[^.]+\./i,
  ];
  for (const pattern of descPatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      description = match[0].trim().substring(0, 300);
      break;
    }
  }

  return {
    id,
    type,
    address,
    city,
    arrondissement,
    surface,
    rooms,
    occupancy,
    description,
    miseAPrix,
    auctionDate,
    tribunal,
    visitDate,
    lawyer,
    lawyerPhone,
    warnings,
  };
}
