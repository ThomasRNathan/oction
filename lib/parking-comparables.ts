import { supabase } from "./supabase";
import { ParkingComparables, PropertyData } from "./types";

/**
 * Parking-specific comparables.
 *
 * Why: `lib/analyzer.ts → computeVerdict()` divides MAP by surface for €/m²,
 * which is meaningless for parking lots that don't expose a surface. Instead,
 * we surface the median *adjudication / parking unit* from past sold parking
 * lots in the same tribunal (or department / nationally as fallback), and
 * a ratio vs the live MAP/unit.
 *
 * Returns null when the property is not a parking lot or when MAP/nUnits are
 * missing.
 */

const PARKING_TYPES = new Set([
  "Parking",
  "parking",
  "Cave",
  "cave",
  "Box",
  "box",
  "Garage",
  "garage",
  "Emplacement",
  "emplacement",
]);

const PARKING_TYPE_PATTERNS = [
  /\bparking/i,
  /\bcave\b/i,
  /\bgarage\b/i,
  /\bbox\b/i,
  /\bemplacement/i,
];

/** Estimate yearly rent for a parking spot in a French commune.
 *  Very rough — only used to compute a "cap rate hint" so the user has a
 *  back-of-envelope yield number. Returns null if we don't have a tier
 *  for the city/department. */
function estimateAnnualRentPerParking(
  city: string | undefined,
  arrondissement: number | undefined
): number | null {
  if (!city) return null;
  const c = city.toLowerCase();
  // Paris by arrondissement (rough Spotahome/Yespark medians, 2025).
  if (c === "paris" && arrondissement) {
    if ([1, 2, 6, 7, 8, 16].includes(arrondissement)) return 2400; // 200/mo
    if ([3, 4, 5, 9, 10, 11, 14, 15, 17].includes(arrondissement)) return 2000;
    return 1700; // 12, 13, 18, 19, 20
  }
  if (c === "paris") return 2000;
  if (
    [
      "neuilly-sur-seine",
      "boulogne-billancourt",
      "levallois-perret",
      "issy-les-moulineaux",
      "courbevoie",
      "vincennes",
      "saint-mande",
    ].includes(c.replace(/\s+/g, "-"))
  ) return 1800;
  if (
    [
      "lyon",
      "marseille",
      "nice",
      "bordeaux",
      "toulouse",
      "rennes",
      "nantes",
      "strasbourg",
      "lille",
      "montpellier",
    ].includes(c)
  ) return 1200;
  // Petite couronne, mid-tier cities.
  return 900;
}

export async function computeParkingComparables(
  property: PropertyData
): Promise<ParkingComparables | null> {
  // Gate: must be a parking type AND have MAP + nUnits.
  if (!property.type) return null;
  const isParking =
    PARKING_TYPES.has(property.type) ||
    PARKING_TYPE_PATTERNS.some((re) => re.test(property.type ?? ""));
  if (!isParking) return null;

  if (!property.miseAPrix || !property.nUnits || property.nUnits < 1) return null;

  const miseAPrixPerUnit = property.miseAPrix / property.nUnits;

  // Build the comparables query: sold parking lots with adjudication > 0,
  // matching parking-style property_type, with non-null lot_count.
  // We don't store n_units yet for past rows, so we re-derive nUnits from
  // property_type using the same ordinal vocabulary.

  // Pull a generous candidate pool (~500 rows) filtered to anything
  // parking-shaped, then compute n_units in JS.
  const { data, error } = await supabase
    .from("past_auctions")
    .select(
      "licitor_id, lot_index, city, tribunal, property_type, mise_a_prix, adjudication_price, status"
    )
    .eq("status", "sold")
    .not("adjudication_price", "is", null)
    .gt("adjudication_price", 0)
    .or(
      "property_type.ilike.%parking%,property_type.ilike.%cave%,property_type.ilike.%garage%,property_type.ilike.%box%,property_type.ilike.%emplacement%"
    )
    .limit(2000);

  if (error || !data) {
    return {
      nUnits: property.nUnits,
      miseAPrixPerUnit: Math.round(miseAPrixPerUnit),
      comparableCount: 0,
      medianAdjPerUnit: 0,
      meanAdjPerUnit: 0,
      ratio: 0,
      capRateHint: null,
      rationale: "Pas de comparables en base (erreur de requête).",
      scope: "national",
    };
  }

  type Row = {
    tribunal: string | null;
    property_type: string | null;
    adjudication_price: number;
    mise_a_prix: number | null;
    city: string | null;
  };

  const rows: Row[] = (data as Row[]).filter(
    (r) => r.adjudication_price && r.adjudication_price > 0
  );

  // Compute adj/unit per row by re-deriving nUnits from property_type.
  const ORDINALS: Record<string, number> = {
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
  function deriveUnits(typeRaw: string | null): number {
    if (!typeRaw) return 1;
    const digit = typeRaw.match(/^\s*(?:lot\s+de\s+)?(\d{1,3})\s+/i);
    if (digit) return parseInt(digit[1], 10);
    const m = typeRaw
      .toLowerCase()
      .replace(/\s+et\s+/g, "-")
      .replace(/\s+/g, "-")
      .match(/^([a-zàâéèêëîïôöùûüÿç-]+)/);
    if (!m) return 1;
    return ORDINALS[m[1]] ?? 1;
  }

  const enriched = rows.map((r) => ({
    ...r,
    nUnits: deriveUnits(r.property_type),
  }));

  // Tier the comparable set: tribunal → department → national.
  // We don't have department on each row directly, but tribunal is a strong
  // proxy for region. Use ILIKE match on tribunal.
  const tribunalKey = (property.tribunal ?? "").toLowerCase();
  let scope: ParkingComparables["scope"] = "national";
  let pool = enriched;
  if (tribunalKey) {
    const inTribunal = enriched.filter((r) =>
      (r.tribunal ?? "").toLowerCase().includes(tribunalKey.replace(/^tribunal\s+(judiciaire\s+de\s+)?/i, ""))
    );
    if (inTribunal.length >= 8) {
      pool = inTribunal;
      scope = "tribunal";
    }
  }
  // Department fallback: if city is in 78 (Yvelines), narrow to rows whose
  // tribunal mentions the same dept name. Skipping for now — tribunal scope
  // already gives reasonable locality. The "department" scope label is
  // reserved for a future enrichment.

  const adjPerUnit = pool
    .map((r) => r.adjudication_price / Math.max(1, r.nUnits))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  if (adjPerUnit.length === 0) {
    return {
      nUnits: property.nUnits,
      miseAPrixPerUnit: Math.round(miseAPrixPerUnit),
      comparableCount: 0,
      medianAdjPerUnit: 0,
      meanAdjPerUnit: 0,
      ratio: 0,
      capRateHint: null,
      rationale:
        "Pas de comparables sold en base pour ce type de bien (parkings).",
      scope,
    };
  }

  const median =
    adjPerUnit.length % 2 === 1
      ? adjPerUnit[(adjPerUnit.length - 1) >> 1]
      : (adjPerUnit[adjPerUnit.length / 2 - 1] +
          adjPerUnit[adjPerUnit.length / 2]) /
        2;
  const mean =
    adjPerUnit.reduce((a, b) => a + b, 0) / adjPerUnit.length;
  const ratio = miseAPrixPerUnit / median;

  // Cap-rate hint = (annual rent / unit) / (median adj / unit).
  const annualRent = estimateAnnualRentPerParking(
    property.city,
    property.arrondissement
  );
  const capRateHint = annualRent ? annualRent / median : null;

  // Human rationale.
  let rationale: string;
  if (ratio < 0.5) {
    rationale = `MAP ${Math.round(miseAPrixPerUnit).toLocaleString("fr-FR")} €/place vs médiane d'adjudication ${Math.round(median).toLocaleString("fr-FR")} €/place sur ${adjPerUnit.length} comparables — décote de ${Math.round((1 - ratio) * 100)} % au seuil. Forte marge avant adjudication probable.`;
  } else if (ratio < 0.85) {
    rationale = `MAP ${Math.round(miseAPrixPerUnit).toLocaleString("fr-FR")} €/place vs médiane ${Math.round(median).toLocaleString("fr-FR")} €/place — réaliste, montée des enchères probable.`;
  } else if (ratio < 1.15) {
    rationale = `MAP au niveau du marché (${Math.round(ratio * 100)} % de la médiane historique).`;
  } else {
    rationale = `MAP au-dessus de la médiane historique (${Math.round(ratio * 100)} %) — adjudication non garantie.`;
  }

  return {
    nUnits: property.nUnits,
    miseAPrixPerUnit: Math.round(miseAPrixPerUnit),
    comparableCount: adjPerUnit.length,
    medianAdjPerUnit: Math.round(median),
    meanAdjPerUnit: Math.round(mean),
    ratio: Math.round(ratio * 100) / 100,
    capRateHint: capRateHint
      ? Math.round(capRateHint * 1000) / 1000
      : null,
    rationale,
    scope,
  };
}
