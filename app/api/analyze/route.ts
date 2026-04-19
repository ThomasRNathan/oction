import { NextRequest, NextResponse } from "next/server";
import { scrapeListicor } from "@/lib/scraper";
import { geocodeAddress } from "@/lib/geocoder";
import { getDVFAnalysis } from "@/lib/dvf";
import { computeVerdict, computeFinancing, computeAttractiveness } from "@/lib/analyzer";
import { PARIS_ARRONDISSEMENTS } from "@/lib/constants";
import { AnalysisResult } from "@/lib/types";

export const maxDuration = 30;
export const preferredRegion = "cdg1"; // Paris — keeps CEREMA latency low

/** Wraps a promise so it resolves to null after `ms` milliseconds instead of blocking. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}

export async function POST(request: NextRequest) {
  try {
    const { url, rate, duration } = await request.json();

    if (!url || !url.includes("licitor.com")) {
      return NextResponse.json(
        { error: "URL licitor.com invalide" },
        { status: 400 }
      );
    }

    // Step 1: Scrape + geocode in parallel (independent of each other)
    const addressQuery = (prop: Awaited<ReturnType<typeof scrapeListicor>>) =>
      prop.address || `Paris ${prop.arrondissement}e`;

    const property = await scrapeListicor(url);
    const geocoding = await geocodeAddress(addressQuery(property), property.arrondissement).catch(() => null);

    // Step 2: DVF — capped at 7s so total response stays under maxDuration
    let dvf = null;
    if (geocoding) {
      const codeInsee =
        geocoding.citycode ??
        (property.arrondissement
          ? PARIS_ARRONDISSEMENTS[property.arrondissement]?.code
          : undefined);

      const propertyType =
        property.type?.toLowerCase() === "appartement" ? "Appartement"
        : property.type?.toLowerCase() === "maison" ? "Maison"
        : undefined;

      dvf = await withTimeout(
        getDVFAnalysis(geocoding.lat, geocoding.lon, propertyType, codeInsee),
        7000
      );
    }

    // Step 3: Verdict
    let verdict = null;
    if (property.miseAPrix && property.surface && dvf) {
      verdict = computeVerdict(property.miseAPrix, property.surface, dvf.medianPricePerSqm);
    }

    // Step 4: Financing
    const financing = property.miseAPrix
      ? computeFinancing(property.miseAPrix, rate || 3.5, duration || 20)
      : undefined;

    // Step 5: Attractiveness
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
        error: error instanceof Error ? error.message : "Erreur lors de l'analyse",
      },
      { status: 500 }
    );
  }
}
