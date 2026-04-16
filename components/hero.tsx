export function Hero() {
  return (
    <div className="text-center mb-16">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        Ventes aux enchères judiciaires
      </div>

      {/* Main title */}
      <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-2 leading-none">
        <span className="bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent">
          OCTION
        </span>
        <sup className="text-orange-400/60 text-2xl md:text-3xl align-super ml-1">*</sup>
      </h1>

      {/* Subtitle */}
      <p className="text-xl md:text-2xl font-semibold text-slate-300 mb-2">
        Enchères immobilières
      </p>

      {/* Value prop */}
      <p className="text-3xl md:text-4xl font-black text-white mb-3">
        Achetez à{" "}
        <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
          −30/40%
        </span>{" "}
        du marché
      </p>

      <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base mb-8">
        Analysez n&apos;importe quel lot sur licitor.com en un clic — prix du marché,
        simulation de financement, score d&apos;attractivité.
      </p>

      {/* Stats */}
      <div className="flex flex-wrap justify-center gap-6 mb-4">
        {[
          { value: "DVF", label: "données officielles" },
          { value: "0€", label: "gratuit" },
          { value: "< 10s", label: "analyse complète" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-2xl font-black text-white">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Footnote */}
      <p className="text-xs text-slate-700 mt-2">
        <sup>*</sup>Oction = <em>auction</em>, enchère en anglais
      </p>
    </div>
  );
}
