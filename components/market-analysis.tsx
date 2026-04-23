import { DVFAnalysis, Verdict } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

/** Human-readable scope label — "rayon 500 m" or "commune entière". */
function scopeLabel(radiusUsed: number): string {
  if (radiusUsed <= 0) return "commune entière";
  if (radiusUsed >= 1000) return `rayon ${(radiusUsed / 1000).toLocaleString("fr-FR")} km`;
  return `rayon ${radiusUsed} m`;
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
        Prix du marché (DVF)
      </h2>

      {/* Hero: median price/sqm — always shown */}
      <div className="text-center mb-5 py-4 rounded-xl bg-slate-900/60 border border-slate-700/50">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
          Prix médian de la zone
        </p>
        <p className="text-4xl font-black text-white">
          {fmt(dvf.medianPricePerSqm)}
          <span className="text-lg font-normal text-slate-400 ml-1">€/m²</span>
        </p>
        <p className="text-xs text-slate-600 mt-1">
          sur {dvf.count} ventes · {scopeLabel(dvf.radiusUsed)} · {dvf.periodYears} an{dvf.periodYears > 1 ? "s" : ""}
        </p>
      </div>

      {/* Verdict badge + comparison */}
      {verdict && (
        <div className="mb-5 text-center space-y-3">
          <div
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border"
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

          {/* Price comparison bar */}
          <div className="relative h-8 flex items-center rounded-lg overflow-hidden bg-slate-900/60">
            {/* Auction price fill */}
            <div
              className="absolute left-0 top-0 h-full rounded-lg transition-all"
              style={{
                width: `${Math.min(100, (verdict.auctionPricePerSqm / verdict.marketPricePerSqm) * 100)}%`,
                background: verdict.color + "30",
                borderRight: `2px solid ${verdict.color}`,
              }}
            />
            <div className="relative w-full flex justify-between px-3 text-xs">
              <span style={{ color: verdict.color }} className="font-semibold">
                Enchère : {fmt(verdict.auctionPricePerSqm)} €/m²
              </span>
              <span className="text-slate-400">
                Marché : {fmt(verdict.marketPricePerSqm)} €/m²
              </span>
            </div>
          </div>

          <p className="text-2xl font-black" style={{ color: verdict.color }}>
            {verdict.discountPercent > 0 ? "−" : "+"}
            {Math.abs(verdict.discountPercent)}%{" "}
            <span className="text-sm font-normal text-slate-400">
              {verdict.discountPercent > 0 ? "sous le marché" : "au-dessus du marché"}
            </span>
          </p>
        </div>
      )}

      {/* Stats table */}
      <div className="space-y-2 text-sm border-t border-slate-700/50 pt-4">
        <Row label="Prix moyen / m²" value={`${fmt(dvf.meanPricePerSqm)} €`} />
        <Row
          label="Fourchette"
          value={`${fmt(dvf.minPricePerSqm)} – ${fmt(dvf.maxPricePerSqm)} €/m²`}
        />
        <Row label="Transactions" value={`${dvf.count} ventes`} />
        <Row
          label="Période"
          value={`${dvf.periodYears} an${dvf.periodYears > 1 ? "s" : ""}`}
        />
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-400">
          La mise à prix est le prix plancher. Les enchères finales dépassent
          généralement la mise à prix de 50 à 100%. Source : DVF (data.gouv.fr).
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
