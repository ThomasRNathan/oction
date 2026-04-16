"use client";

import { useState } from "react";
import { Hero } from "@/components/hero";
import { UrlInput } from "@/components/url-input";
import { PropertyCard } from "@/components/property-card";
import { AuctionInfo } from "@/components/auction-info";
import { MarketAnalysis } from "@/components/market-analysis";
import { FinancingSimulator } from "@/components/financing-simulator";
import { AttractivenessCard } from "@/components/attractiveness-score";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { AnalysisResult } from "@/lib/types";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState<string>("");

  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalyzedUrl(url);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'analyse");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de l'analyse"
      );
    } finally {
      setLoading(false);
    }
  };

  /** Build an avocat search URL contextualised to the property */
  const lawyerSearchUrl = (r: AnalysisResult) => {
    const city = r.property.tribunal?.replace("Tribunal Judiciaire de ", "") || "Paris";
    return `https://www.barreau-paris.fr/trouver-un-avocat/?specialite=encheres-immobilieres&ville=${encodeURIComponent(city)}`;
  };

  return (
    <main className="min-h-screen bg-[#0a0f1a] overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-orange-500/8 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/6 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16">
        <Hero />
        <UrlInput onSubmit={handleAnalyze} loading={loading} />

        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center text-sm">
            {error}
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {result && (
          <div className="space-y-6">
            {/* Row 1: Property + Auction info */}
            <div className="grid md:grid-cols-2 gap-6">
              <PropertyCard property={result.property} />
              <AuctionInfo property={result.property} />
            </div>

            {/* Row 2: DVF market + Attractiveness */}
            <div className="grid md:grid-cols-2 gap-6">
              {result.dvf ? (
                <MarketAnalysis dvf={result.dvf} verdict={result.verdict ?? null} />
              ) : (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">📊</span>
                  <p className="text-slate-400 font-medium text-center">Données DVF indisponibles</p>
                  <p className="text-xs text-slate-600 text-center">
                    L&apos;API de données foncières n&apos;a pas retourné de résultats pour cette zone.
                  </p>
                </div>
              )}

              {result.attractiveness && (
                <AttractivenessCard attractiveness={result.attractiveness} />
              )}
            </div>

            {/* Row 3: Financing (full width) */}
            {result.property.miseAPrix && (
              <FinancingSimulator
                miseAPrix={result.property.miseAPrix}
                initialFinancing={result.financing}
              />
            )}

            {/* CTA: Trouver un avocat */}
            <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-1">
                    Étape suivante
                  </p>
                  <h3 className="text-xl font-bold text-white">
                    Trouver un avocat inscrit au Tribunal
                  </h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-lg">
                    Pour enchérir, vous devez être représenté par un avocat inscrit au barreau du
                    tribunal de vente. Il se charge du chèque de banque, du dépôt de l&apos;offre et des
                    formalités post-adjudication.
                  </p>
                  {result.property.lawyer && (
                    <p className="text-xs text-slate-500 mt-2">
                      Avocat poursuivant la vente : <span className="text-slate-300">{result.property.lawyer}</span>
                      {result.property.lawyerPhone && (
                        <> · <a href={`tel:${result.property.lawyerPhone}`} className="text-orange-400 hover:underline">{result.property.lawyerPhone}</a></>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                  <a
                    href={lawyerSearchUrl(result)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all text-sm text-center whitespace-nowrap"
                  >
                    Trouver un avocat →
                  </a>
                  <a
                    href={analyzedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-slate-700/50 border border-slate-600 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-all text-sm text-center whitespace-nowrap"
                  >
                    Voir l&apos;annonce
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 text-center text-xs text-slate-700 space-y-1">
          <p>
            OCTION utilise les données DVF (CEREMA / data.gouv.fr) et l&apos;API Adresse du gouvernement.
          </p>
          <p>Données indicatives — non contractuelles.</p>
        </footer>
      </div>
    </main>
  );
}
