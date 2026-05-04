/**
 * Normalize a raw `tribunal` string from past_auctions / live licitor pages
 * into a stable short label like "TJ Paris", "TJ Bobigny", "Notaire", etc.
 *
 * The raw values are extremely noisy — e.g.
 *   "Tribunal Judiciaire de Paris\n parvis du Tribunal\n Paris 17ème"
 *   "Tribunal de Grande Instance de Versailles - 5\n place André Mignot..."
 *   "Vente en l'Étude de Maître Guillou\n Notaire à Nantes"
 *
 * We use regex matching on the city token (after "de "/"d'"/"des") rather
 * than the giant CASE WHEN in the Notion SQL — it's resilient to format
 * drift and one place to fix when a new tribunal appears.
 *
 * Returned label is what the analytics script aggregates on AND what the
 * live analyzer's UncontestedScore looks up in the rates table.
 */

const TRIBUNAL_CITIES: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  // Paris area first (most frequent)
  { pattern: /\bParis\b/i, label: "TJ Paris" },
  { pattern: /\bBobigny\b/i, label: "TJ Bobigny" },
  { pattern: /\bNanterre\b/i, label: "TJ Nanterre" },
  { pattern: /\bCr[ée]teil\b/i, label: "TJ Créteil" },
  { pattern: /\bVersailles\b/i, label: "TJ Versailles" },
  { pattern: /\bPontoise\b/i, label: "TJ Pontoise" },
  { pattern: /\bMeaux\b/i, label: "TJ Meaux" },
  { pattern: /\bMelun\b/i, label: "TJ Melun" },
  { pattern: /\b[ÉE]vry(-Courcouronnes)?\b/i, label: "TJ Evry" },
  { pattern: /\bFontainebleau\b/i, label: "TJ Fontainebleau" },

  // Major regional capitals
  { pattern: /\bBordeaux\b/i, label: "TJ Bordeaux" },
  { pattern: /\bToulouse\b/i, label: "TJ Toulouse" },
  { pattern: /\bMarseille\b/i, label: "TJ Marseille" },
  { pattern: /\bAix-?en-?Provence\b/i, label: "TJ Aix-en-Provence" },
  { pattern: /\bMontpellier\b/i, label: "TJ Montpellier" },
  { pattern: /\bNice\b/i, label: "TJ Nice" },
  { pattern: /\bGrasse\b/i, label: "TJ Grasse" },
  { pattern: /\bToulon\b/i, label: "TJ Toulon" },
  { pattern: /\bDraguignan\b/i, label: "TJ Draguignan" },
  { pattern: /\bLyon\b/i, label: "TJ Lyon" },
  { pattern: /\bGrenoble\b/i, label: "TJ Grenoble" },
  { pattern: /\bChamb[ée]ry\b/i, label: "TJ Chambéry" },
  { pattern: /\bThonon\b/i, label: "TJ Thonon" },
  { pattern: /\bBonneville\b/i, label: "TJ Bonneville" },
  { pattern: /\bAlbertville\b/i, label: "TJ Albertville" },
  { pattern: /\bGap\b/i, label: "TJ Gap" },
  { pattern: /\bDigne(-les-Bains)?\b/i, label: "TJ Digne-les-Bains" },
  { pattern: /\bAvignon\b/i, label: "TJ Avignon" },
  { pattern: /\bN[îi]mes\b/i, label: "TJ Nimes" },
  { pattern: /\bTarascon(-sur-Rh[oô]ne)?\b/i, label: "TJ Tarascon" },
  { pattern: /\bAl[èe]s\b/i, label: "TJ Alès" },
  { pattern: /\bCarpentras\b/i, label: "TJ Carpentras" },
  { pattern: /\bB[ée]ziers\b/i, label: "TJ Beziers" },
  { pattern: /\bNarbonne\b/i, label: "TJ Narbonne" },
  { pattern: /\bCarcassonne\b/i, label: "TJ Carcassonne" },
  { pattern: /\bPerpignan\b/i, label: "TJ Perpignan" },

  // West / Atlantic
  { pattern: /\bNantes\b/i, label: "TJ Nantes" },
  { pattern: /\bSaint[- ]Nazaire\b/i, label: "TJ Saint-Nazaire" },
  { pattern: /\bAngers\b/i, label: "TJ Angers" },
  { pattern: /\bLe Mans\b/i, label: "TJ Le Mans" },
  { pattern: /\bRennes\b/i, label: "TJ Rennes" },
  { pattern: /\bLorient\b/i, label: "TJ Lorient" },
  { pattern: /\bQuimper\b/i, label: "TJ Quimper" },
  { pattern: /\bBrest\b/i, label: "TJ Brest" },
  { pattern: /\bLa Rochelle\b/i, label: "TJ La Rochelle" },
  { pattern: /\bPoitiers\b/i, label: "TJ Poitiers" },
  { pattern: /\bLimoges\b/i, label: "TJ Limoges" },
  { pattern: /\bLibourne\b/i, label: "TJ Libourne" },
  { pattern: /\bP[ée]rigueux\b/i, label: "TJ Périgueux" },
  { pattern: /\bAgen\b/i, label: "TJ Agen" },
  { pattern: /\bBayonne\b/i, label: "TJ Bayonne" },
  { pattern: /\bPau\b/i, label: "TJ Pau" },
  { pattern: /\bTarbes\b/i, label: "TJ Tarbes" },
  { pattern: /\bDax\b/i, label: "TJ Dax" },
  { pattern: /\bMont[- ]de[- ]Marsan\b/i, label: "TJ Mont de Marsan" },
  { pattern: /\bSables d'?Olonne\b/i, label: "TJ Sables d'Olonne" },

  // North / East
  { pattern: /\bLille\b/i, label: "TJ Lille" },
  { pattern: /\bDouai\b/i, label: "TJ Douai" },
  { pattern: /\bB[ée]thune\b/i, label: "TJ Bethune" },
  { pattern: /\bRouen\b/i, label: "TJ Rouen" },
  { pattern: /\b[ÉE]vreux\b/i, label: "TJ Evreux" },
  { pattern: /\bAmiens\b/i, label: "TJ Amiens" },
  { pattern: /\b[ÉE]pinal\b/i, label: "TJ Epinal" },
  { pattern: /\bMetz\b/i, label: "TJ Metz" },
  { pattern: /\bNancy\b/i, label: "TJ Nancy" },
  { pattern: /\bStrasbourg\b/i, label: "TJ Strasbourg" },
  { pattern: /\bColmar\b/i, label: "TJ Colmar" },
  { pattern: /\bMulhouse\b/i, label: "TJ Mulhouse" },
  { pattern: /\bBesan[çc]on\b/i, label: "TJ Besancon" },
  { pattern: /\bBelfort\b/i, label: "TJ Belfort" },
  { pattern: /\bVerdun\b/i, label: "TJ Verdun" },

  // Centre
  { pattern: /\bDijon\b/i, label: "TJ Dijon" },
  { pattern: /\bBourges\b/i, label: "TJ Bourges" },
  { pattern: /\bCh[âa]teauroux\b/i, label: "TJ Chateauroux" },
  { pattern: /\bTours\b/i, label: "TJ Tours" },
  { pattern: /\bMontargis\b/i, label: "TJ Montargis" },
  { pattern: /\bOrl[ée]ans\b/i, label: "TJ Orléans" },
  { pattern: /\bClermont-?Ferrand\b/i, label: "TJ Clermont-Ferrand" },
  { pattern: /\bSaint[- ][ÉEé]tienne\b/i, label: "TJ Saint Etienne" },
  { pattern: /\bVillefranche\b/i, label: "TJ Villefranche" },
  { pattern: /\bBourg[- ]en[- ]Bresse\b/i, label: "TJ Bourg en Bresse" },
  { pattern: /\bVienne\b/i, label: "TJ Vienne" },
  { pattern: /\bN[ée]vers\b/i, label: "TJ Nevers" },
  { pattern: /\bCahors\b/i, label: "TJ Cahors" },
  { pattern: /\bRodez\b/i, label: "TJ Rodez" },
  { pattern: /\bAuch\b/i, label: "TJ Auch" },
  { pattern: /\bAlbi\b/i, label: "TJ Albi" },

  // DOM
  { pattern: /\bPointe.?[àa].?Pitre\b/i, label: "TJ Pointe à Pitre" },
  { pattern: /\bFort[- ]de[- ]France\b/i, label: "TJ Fort-de-France" },
  { pattern: /\bSaint[- ]Denis\b.*R[ée]union/i, label: "TJ Saint-Denis (Réunion)" },
  { pattern: /\bCayenne\b/i, label: "TJ Cayenne" },
];

/**
 * Returns a normalised tribunal label, or null if we cannot identify the city.
 * For null returns, callers should still bucket the row (e.g. as "Autre")
 * rather than dropping it from the analysis.
 */
export function normalizeTribunal(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.toString();

  // Notaire fallback: "Vente en l'Étude de Maître X, Notaire à Y"
  if (/notaire/i.test(text) || /\bMa[îi]tre\b/i.test(text)) {
    // Try to grab the city after "à" or "de"
    for (const { pattern, label } of TRIBUNAL_CITIES) {
      if (pattern.test(text)) return `Notaire (${label.replace(/^TJ /, "")})`;
    }
    return "Notaire";
  }

  for (const { pattern, label } of TRIBUNAL_CITIES) {
    if (pattern.test(text)) return label;
  }
  return null;
}
