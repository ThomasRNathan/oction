import { DVFAnalysis, Verdict } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function MarketAnalysis({
  dvf,
  verdict,
}: {
  dvf: DVFAnalysis;
  verdict: Verdict | null;
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Analyse du marché (DVF)
      </h2>

      {verdict && (
        <div className="mb-6 text-center">
          <div
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border"
            style={{
              color: verdict.color,
              borderColor: verdict.color + "40",
              backgroundColor: verdict.color + "15",
            }}
          >
            {verdict.rating === "excellent" && "★★★ "}
            {verdict.rating === "good" && "★★ "}
            {verdict.rating === "fair" && "★ "}
            {verdict.label}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Prix enchère / m²</p>
              <p className="text-2xl font-bold text-white">
                {fmt(verdict.auctionPricePerSqm)} <span className="text-sm text-slate-400">EUR</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Prix marché / m²</p>
              <p className="text-2xl font-bold text-white">
                {fmt(verdict.marketPricePerSqm)} <span className="text-sm text-slate-400">EUR</span>
              </p>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-sm">
              <span
                className="font-bold text-lg"
                style={{ color: verdict.color }}
              >
                {verdict.discountPercent > 0 ? "-" : "+"}
                {Math.abs(verdict.discountPercent)}%
              </span>
              <span className="text-slate-500 ml-2">
                {verdict.discountPercent > 0
                  ? "sous le prix du marché"
                  : "au-dessus du marché"}
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Transactions analysées</span>
          <span className="text-white">{dvf.count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Prix médian / m²</span>
          <span className="text-white">{fmt(dvf.medianPricePerSqm)} EUR</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Prix moyen / m²</span>
          <span className="text-white">{fmt(dvf.meanPricePerSqm)} EUR</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Fourchette</span>
          <span className="text-white">
            {fmt(dvf.minPricePerSqm)} - {fmt(dvf.maxPricePerSqm)} EUR/m²
          </span>
        </div>
        {dvf.radiusUsed > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Rayon de recherche</span>
            <span className="text-white">{dvf.radiusUsed}m</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Période</span>
          <span className="text-white">
            {dvf.periodYears} an{dvf.periodYears > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-400">
          La mise à prix est le prix de départ. Les enchères finales
          dépassent généralement la mise à prix de 50 à 100%. Source : DVF
          (données foncières publiques).
        </p>
      </div>
    </div>
  );
}
