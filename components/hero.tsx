/**
 * Compact hero: brand + value prop in ~40 % of the old height so the live
 * deal radar is visible without scrolling. The marketing stats row moved into
 * the radar's live stat tiles.
 */
export function Hero() {
  return (
    <div className="text-center mb-10 animate-fade-up">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        Ventes aux enchères judiciaires
      </div>

      {/* Main title */}
      <h1
        className="text-5xl md:text-7xl font-black tracking-tight mb-3 leading-none"
        title="Oction = auction, enchère en anglais"
      >
        <span className="bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent">
          OCTION
        </span>
      </h1>

      {/* Value prop */}
      <p className="text-2xl md:text-3xl font-black text-white mb-3">
        Achetez à{" "}
        <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
          −30/40%
        </span>{" "}
        du marché
      </p>

      <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base">
        Collez une annonce licitor.com — prix marché DVF, décote, score
        d&apos;attractivité et financement en moins de 10 secondes.
      </p>
    </div>
  );
}
