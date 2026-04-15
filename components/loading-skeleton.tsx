export function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4"
          >
            <div className="h-5 bg-slate-700 rounded w-1/3" />
            <div className="space-y-3">
              <div className="h-4 bg-slate-700/50 rounded w-full" />
              <div className="h-4 bg-slate-700/50 rounded w-4/5" />
              <div className="h-4 bg-slate-700/50 rounded w-3/5" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-slate-600 text-sm">
        Analyse en cours... Scraping, géocodage, données DVF...
      </p>
    </div>
  );
}
