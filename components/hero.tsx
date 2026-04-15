export function Hero() {
  return (
    <div className="text-center mb-12">
      <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4">
        <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
          OCTION
        </span>
      </h1>
      <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
        Analysez les ventes aux enchères immobilières en un clic.
        <br />
        <span className="text-slate-500">
          Prix du marché, estimation au m², simulateur de financement.
        </span>
      </p>
    </div>
  );
}
