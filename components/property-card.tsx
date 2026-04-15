import { PropertyData } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function PropertyCard({ property }: { property: PropertyData }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        Bien immobilier
      </h2>

      <div className="space-y-3">
        {property.type && (
          <div className="flex justify-between">
            <span className="text-slate-500">Type</span>
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
              {property.type}
            </span>
          </div>
        )}
        {property.address && (
          <div className="flex justify-between">
            <span className="text-slate-500">Adresse</span>
            <span className="text-white text-right max-w-[60%]">
              {property.address}
            </span>
          </div>
        )}
        {property.arrondissement && (
          <div className="flex justify-between">
            <span className="text-slate-500">Arrondissement</span>
            <span className="text-white">Paris {property.arrondissement}e</span>
          </div>
        )}
        {property.surface && (
          <div className="flex justify-between">
            <span className="text-slate-500">Surface</span>
            <span className="text-white font-medium">
              {property.surface} m²
            </span>
          </div>
        )}
        {property.rooms && (
          <div className="flex justify-between">
            <span className="text-slate-500">Pièces</span>
            <span className="text-white">{property.rooms}</span>
          </div>
        )}
        {property.occupancy && (
          <div className="flex justify-between">
            <span className="text-slate-500">Occupation</span>
            <span
              className={`font-medium ${property.occupancy === "Libre" ? "text-green-400" : "text-amber-400"}`}
            >
              {property.occupancy}
            </span>
          </div>
        )}
        {property.description && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-sm text-slate-400 italic">
              {property.description}
            </p>
          </div>
        )}
      </div>

      {property.warnings.length > 0 && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            {property.warnings.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
