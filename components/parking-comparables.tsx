import { ParkingComparables } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

function scopeLabel(scope: ParkingComparables["scope"]): string {
  if (scope === "tribunal") return "même tribunal";
  if (scope === "department") return "même département";
  return "France entière";
}

function ratioColor(ratio: number): { color: string; rating: string } {
  if (ratio < 0.5) return { color: "#22c55e", rating: "★★★ Forte décote" };
  if (ratio < 0.85) return { color: "#3b82f6", rating: "★★ Réaliste" };
  if (ratio < 1.15) return { color: "#f59e0b", rating: "★ Au marché" };
  return { color: "#ef4444", rating: "Au-dessus du marché" };
}

export function ParkingComparablesCard({
  comparables,
}: {
  comparables: ParkingComparables;
}) {
  const { color, rating } = ratioColor(comparables.ratio);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        Comparables parkings
      </h2>

      {/* Hero: median adjudication per unit */}
      <div className="text-center mb-5 py-4 rounded-xl bg-slate-900/60 border border-slate-700/50">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
          Adjudication médiane par place
        </p>
        <p className="text-4xl font-black text-white">
          {fmt(comparables.medianAdjPerUnit)}
          <span className="text-lg font-normal text-slate-400 ml-1">€</span>
        </p>
        <p className="text-xs text-slate-600 mt-1">
          sur {comparables.comparableCount} ventes · {scopeLabel(comparables.scope)}
        </p>
      </div>

      {/* Verdict badge */}
      <div className="mb-5 text-center space-y-3">
        <div
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border"
          style={{
            color,
            borderColor: color + "40",
            backgroundColor: color + "15",
          }}
        >
          {rating}
        </div>
      </div>

      {/* Side-by-side: MAP/place vs market median */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            MAP / place
          </p>
          <p className="text-xl font-bold text-white">
            {fmt(comparables.miseAPrixPerUnit)}
            <span className="text-xs font-normal text-slate-400 ml-1">€</span>
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            {comparables.nUnits} places ×
          </p>
        </div>
        <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Ratio MAP/médiane
          </p>
          <p className="text-xl font-bold" style={{ color }}>
            {Math.round(comparables.ratio * 100)}
            <span className="text-xs font-normal ml-1">%</span>
          </p>
          {comparables.capRateHint !== null && (
            <p className="text-[10px] text-slate-600 mt-1">
              Cap-rate ≈ {(comparables.capRateHint * 100).toFixed(1)} %
            </p>
          )}
        </div>
      </div>

      {/* Rationale */}
      <p className="text-xs text-slate-400 leading-relaxed">
        {comparables.rationale}
      </p>

      <p className="text-[10px] text-slate-600 mt-3 italic">
        Pas de €/m² pour les parkings : on compare le prix par place.
      </p>
    </div>
  );
}
