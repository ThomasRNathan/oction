import { NextRequest, NextResponse } from "next/server";
import { scrapeListicor } from "@/lib/scraper";
import { geocodeAddress } from "@/lib/geocoder";
import { getDVFAnalysis } from "@/lib/dvf";
import { computeVerdict, computeFinancing, computeAttractiveness } from "@/lib/analyzer";
import { PARIS_ARRONDISSEMENTS } from "@/lib/constants";
import { AnalysisResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { url, rate, duration } = await request.json();

    if (!url || !url.includes("licitor.com")) {
      return NextResponse.json(
        { error: "URL licitor.com invalide" },
        { status: 400 }
      );
    }

    // Step 1: Scrape the listing
    const property = await scrapeListicor(url);

    // Step 2: Geocode the address
    const addressQuery = property.address || `Paris ${property.arrondissement}e`;
    const geocoding = await geocodeAddress(addressQuery, property.arrondissement);

    // Step 3: Get DVF data — prefer citycode from geocoding, fallback to arrondissement code
    let dvf = null;
    if (geocoding) {
      const codeInsee =
        geocoding.citycode ??
        (property.arrondissement
          ? PARIS_ARRONDISSEMENTS[property.arrondissement]?.code
          : undefined);

      const propertyType =
        property.type?.toLowerCase() === "appartement"
          ? "Appartement"
          : property.type?.toLowerCase() === "maison"
            ? "Maison"
            : undefined;

      dvf = await getDVFAnalysis(
        geocoding.lat,
        geocoding.lon,
        propertyType,
        codeInsee
      );
    }

    // Step 4: Compute verdict
    let verdict = null;
    if (property.miseAPrix && property.surface && dvf) {
      verdict = computeVerdict(
        property.miseAPrix,
        property.surface,
        dvf.medianPricePerSqm
      );
    }

    // Step 5: Compute financing
    const financingAmount = property.miseAPrix || 0;
    const financing = financingAmount > 0
      ? computeFinancing(financingAmount, rate || 3.5, duration || 20)
      : undefined;

    // Step 6: Compute attractiveness score
    const attractiveness = computeAttractiveness(property);

    const result: AnalysisResult = {
      property,
      geocoding: geocoding || undefined,
      dvf: dvf || undefined,
      verdict: verdict || undefined,
      financing,
      attractiveness,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'analyse",
      },
      { status: 500 }
    );
  }
}
