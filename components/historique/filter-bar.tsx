"use client";

import type { BrowseFilters } from "@/lib/analytics/past-browse";
import type { PropertyTypeBucket } from "@/lib/analytics/normalize-property-type";
import type { OccupancyBucket } from "@/lib/analytics/normalize-occupancy";

interface Props {
  filters: BrowseFilters;
  setFilters: (next: BrowseFilters) => void;
  tribunals: string[];
  years: number[];
  propertyTypes: readonly PropertyTypeBucket[];
  occupancies: readonly OccupancyBucket[];
}

const SELECT_CLASSES =
  "px-3 py-2 bg-slate-800/70 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50";

const TYPE_LABELS_FR: Record<PropertyTypeBucket, string> = {
  appartement: "Appartement",
  studio: "Studio",
  maison: "Maison",
  immeuble: "Immeuble",
  parking: "Parking",
  terrain: "Terrain",
  local: "Local",
  autre: "Autre",
};

const OCC_LABELS_FR: Record<OccupancyBucket & string, string> = {
  libre: "Libre",
  "occupé": "Occupé",
  "loué": "Loué",
};

export function FilterBar({
  filters,
  setFilters,
  tribunals,
  years,
  propertyTypes,
  occupancies,
}: Props) {
  const hasAny =
    !!filters.tribunal ||
    !!filters.propertyType ||
    !!filters.year ||
    !!filters.occupancy ||
    !!filters.city;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* City contains-search */}
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Ville (contient)
          </span>
          <input
            type="text"
            value={filters.city ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, city: e.target.value || undefined })
            }
            placeholder="Versailles, Marseille…"
            className={SELECT_CLASSES}
          />
        </label>

        {/* Tribunal */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Tribunal
          </span>
          <select
            value={filters.tribunal ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, tribunal: e.target.value || undefined })
            }
            className={SELECT_CLASSES}
          >
            <option value="">Tous</option>
            {tribunals.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {/* Property type */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Type
          </span>
          <select
            value={filters.propertyType ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                propertyType: (e.target.value || undefined) as
                  | PropertyTypeBucket
                  | undefined,
              })
            }
            className={SELECT_CLASSES}
          >
            <option value="">Tous</option>
            {propertyTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS_FR[t]}
              </option>
            ))}
          </select>
        </label>

        {/* Year */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Année
          </span>
          <select
            value={filters.year ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                year: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            className={SELECT_CLASSES}
          >
            <option value="">Toutes</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {/* Occupancy */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Occupation
          </span>
          <select
            value={filters.occupancy ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                occupancy: (e.target.value || undefined) as
                  | OccupancyBucket
                  | undefined,
              })
            }
            className={SELECT_CLASSES}
          >
            <option value="">Toutes</option>
            {occupancies.map((o) => (
              <option key={o} value={o ?? ""}>
                {OCC_LABELS_FR[o as keyof typeof OCC_LABELS_FR]}
              </option>
            ))}
          </select>
        </label>

        {hasAny && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all text-xs"
          >
            ✕ Effacer
          </button>
        )}
      </div>
    </div>
  );
}
