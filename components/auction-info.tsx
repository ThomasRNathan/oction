import { PropertyData } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function AuctionInfo({ property }: { property: PropertyData }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        Enchère
      </h2>

      {property.miseAPrix && (
        <div className="mb-6 text-center">
          <p className="text-sm text-slate-500 mb-1">Mise à prix</p>
          <p className="text-4xl font-black text-white">
            {fmt(property.miseAPrix)}{" "}
            <span className="text-xl text-slate-400">EUR</span>
          </p>
          {property.surface && (
            <p className="text-sm text-slate-500 mt-1">
              soit {fmt(Math.round(property.miseAPrix / property.surface))}{" "}
              EUR/m²
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {property.auctionDate && (
          <div className="flex justify-between">
            <span className="text-slate-500">Date</span>
            <span className="text-white text-right max-w-[65%]">
              {property.auctionDate}
            </span>
          </div>
        )}
        {property.tribunal && (
          <div className="flex justify-between">
            <span className="text-slate-500">Tribunal</span>
            <span className="text-white text-right max-w-[65%]">
              {property.tribunal}
            </span>
          </div>
        )}
        {property.visitDate && (
          <div className="flex justify-between">
            <span className="text-slate-500">Visite</span>
            <span className="text-white text-right max-w-[65%]">
              {property.visitDate}
            </span>
          </div>
        )}
        {property.lawyer && (
          <div className="flex justify-between">
            <span className="text-slate-500">Avocat</span>
            <span className="text-white text-right max-w-[65%]">
              {property.lawyer}
              {property.lawyerPhone && (
                <span className="block text-xs text-slate-500">
                  {property.lawyerPhone}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
