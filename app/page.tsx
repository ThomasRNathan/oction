"use client";

import { useState } from "react";
import { Hero } from "@/components/hero";
import { UrlInput } from "@/components/url-input";
import { PropertyCard } from "@/components/property-card";
import { AuctionInfo } from "@/components/auction-info";
import { MarketAnalysis } from "@/components/market-analysis";
import { FinancingSimulator } from "@/components/financing-simulator";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { AnalysisResult } from "@/lib/types";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

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

  return (
    <main className="min-h-screen bg-[#0a0f1a]">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-orange-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16">
        <Hero />
        <UrlInput onSubmit={handleAnalyze} loading={loading} />

        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {result && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <PropertyCard property={result.property} />
              <AuctionInfo property={result.property} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {result.dvf ? (
                <MarketAnalysis
                  dvf={result.dvf}
                  verdict={result.verdict ?? null}
                />
              ) : (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 flex items-center justify-center">
                  <p className="text-slate-500 text-center">
                    Données DVF indisponibles pour cette zone.
                    <br />
                    <span className="text-xs">
                      L&apos;API de données foncières n&apos;a pas retourné de
                      résultats.
                    </span>
                  </p>
                </div>
              )}

              {result.property.miseAPrix && (
                <FinancingSimulator
                  miseAPrix={result.property.miseAPrix}
                  initialFinancing={result.financing}
                />
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 text-center text-xs text-slate-700">
          <p>
            OCTION utilise les données publiques DVF (Demandes de Valeurs
            Foncières) et l&apos;API Adresse du gouvernement.
          </p>
        </footer>
      </div>
    </main>
  );
}
