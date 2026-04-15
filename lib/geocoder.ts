import { GeocodingResult } from "./types";
import { PARIS_ARRONDISSEMENTS } from "./constants";

export async function geocodeAddress(
  address: string,
  arrondissement?: number
): Promise<GeocodingResult | null> {
  const query = arrondissement
    ? `${address}, Paris ${arrondissement}e`
    : address;

  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);

    const data = await response.json();
    const feature = data.features?.[0];

    if (feature) {
      return {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        score: feature.properties.score,
        label: feature.properties.label,
      };
    }
  } catch {
    // Fall through to arrondissement fallback
  }

  // Fallback: use arrondissement center coordinates
  if (arrondissement && PARIS_ARRONDISSEMENTS[arrondissement]) {
    const arr = PARIS_ARRONDISSEMENTS[arrondissement];
    return {
      lat: arr.lat,
      lon: arr.lon,
      score: 0.3,
      label: arr.name,
    };
  }

  return null;
}
