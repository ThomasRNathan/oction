"use client";

import type { BrowseFilters } from "@/lib/analytics/past-browse";
import type { PropertyTypeBucket } from "@/lib/analytics/normalize-property-type";
import type { OccupancyBucket } from "@/lib/analytics/normalize-occupancy";
import { MultiSelect } from "@/components/historique/multi-select";

interface Props {
  filters: BrowseFilters;
  setFilters: (next: BrowseFilters) => void;
  tribunals: string[];
  years: number[];
  propertyTypes: readonly PropertyTypeBucket[];
  occupancies: readonly OccupancyBucket[];
}

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

type NonNullOcc = Exclude<OccupancyBucket, null>;

const OCC_LABELS_FR: Record<NonNullOcc, string> = {
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
    (filters.tribunals?.length ?? 0) > 0 ||
    (filters.propertyTypes?.length ?? 0) > 0 ||
    (filters.years?.length ?? 0) > 0 ||
    (filters.occupancies?.length ?? 0) > 0 ||
    !!filters.city;

  // Drop nulls — null is a valid OccupancyBucket but never appears in the
  // dropdown allow-list passed by the API.
  const occOptions = occupancies
    .filter((o): o is NonNullOcc => o !== null)
    .map((o) => ({ value: o, label: OCC_LABELS_FR[o] }));

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* City contains-search — stays a free-text input, not a multi-select */}
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
            className="px-3 py-2 bg-slate-800/70 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          />
        </label>

        <MultiSelect<string>
          label="Tribunal"
          options={tribunals.map((t) => ({ value: t, label: t }))}
          selected={filters.tribunals ?? []}
          onChange={(next) =>
            setFilters({
              ...filters,
              tribunals: next.length ? next : undefined,
            })
          }
          width="min-w-[180px]"
        />

        <MultiSelect<PropertyTypeBucket>
          label="Type"
          options={propertyTypes.map((t) => ({
            value: t,
            label: TYPE_LABELS_FR[t],
          }))}
          selected={filters.propertyTypes ?? []}
          onChange={(next) =>
            setFilters({
              ...filters,
              propertyTypes: next.length ? next : undefined,
            })
          }
          width="min-w-[140px]"
        />

        <MultiSelect<number>
          label="Année"
          options={years.map((y) => ({ value: y, label: String(y) }))}
          selected={filters.years ?? []}
          onChange={(next) =>
            setFilters({ ...filters, years: next.length ? next : undefined })
          }
          width="min-w-[120px]"
        />

        <MultiSelect<NonNullOcc>
          label="Occupation"
          options={occOptions}
          selected={(filters.occupancies ?? []).filter(
            (o): o is NonNullOcc => o !== null
          )}
          onChange={(next) =>
            setFilters({
              ...filters,
              occupancies: next.length ? next : undefined,
            })
          }
          width="min-w-[140px]"
        />

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
