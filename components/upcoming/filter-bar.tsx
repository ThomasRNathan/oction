"use client";

import type { UpcomingFilters } from "@/lib/analytics/upcoming-browse";
import type { PropertyTypeBucket } from "@/lib/analytics/normalize-property-type";
import type { OccupancyBucket } from "@/lib/analytics/normalize-occupancy";
import { MultiSelect } from "@/components/historique/multi-select";
import { RangeInput } from "@/components/upcoming/range-input";

interface Props {
  filters: UpcomingFilters;
  setFilters: (next: UpcomingFilters) => void;
  tribunals: string[];
  propertyTypes: readonly PropertyTypeBucket[];
  occupancies: readonly OccupancyBucket[];
  hintMapMin: number | null;
  hintMapMax: number | null;
  hintDvfMin: number | null;
  hintDvfMax: number | null;
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

const HORIZONS: { value: number | null; label: string }[] = [
  { value: 7, label: "7 j" },
  { value: 30, label: "30 j" },
  { value: 90, label: "90 j" },
  { value: null, label: "Tous" },
];

export function FilterBar({
  filters,
  setFilters,
  tribunals,
  propertyTypes,
  occupancies,
  hintMapMin,
  hintMapMax,
  hintDvfMin,
  hintDvfMax,
}: Props) {
  const hasAny =
    (filters.tribunals?.length ?? 0) > 0 ||
    (filters.propertyTypes?.length ?? 0) > 0 ||
    (filters.occupancies?.length ?? 0) > 0 ||
    !!filters.city ||
    filters.mapMin != null ||
    filters.mapMax != null ||
    filters.dvfMin != null ||
    filters.dvfMax != null ||
    filters.withinDays != null;

  const occOptions = occupancies
    .filter((o): o is NonNullOcc => o !== null)
    .map((o) => ({ value: o, label: OCC_LABELS_FR[o] }));

  const activeHorizon = filters.withinDays ?? null;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-4 space-y-3">
      {/* Row 1: dropdowns + city */}
      <div className="flex flex-wrap gap-3 items-end">
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
            placeholder="Paris, Lyon, Marseille…"
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

      {/* Row 2: numeric ranges + horizon pills */}
      <div className="flex flex-wrap gap-3 items-end">
        <RangeInput
          label="Mise à prix"
          min={filters.mapMin ?? null}
          max={filters.mapMax ?? null}
          onChange={(next) =>
            setFilters({
              ...filters,
              mapMin: next.min ?? undefined,
              mapMax: next.max ?? undefined,
            })
          }
          hintMin={hintMapMin}
          hintMax={hintMapMax}
          width="min-w-[200px]"
          suffix="€"
        />

        <RangeInput
          label="Prix estimé DVF"
          min={filters.dvfMin ?? null}
          max={filters.dvfMax ?? null}
          onChange={(next) =>
            setFilters({
              ...filters,
              dvfMin: next.min ?? undefined,
              dvfMax: next.max ?? undefined,
            })
          }
          hintMin={hintDvfMin}
          hintMax={hintDvfMax}
          width="min-w-[200px]"
          suffix="€"
        />

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Horizon
          </span>
          <div className="flex gap-1.5">
            {HORIZONS.map((h) => {
              const active = activeHorizon === h.value;
              return (
                <button
                  key={String(h.value)}
                  type="button"
                  onClick={() =>
                    setFilters({
                      ...filters,
                      withinDays: h.value ?? undefined,
                    })
                  }
                  aria-pressed={active}
                  className={
                    active
                      ? "px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm transition-all"
                      : "px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                  }
                >
                  {h.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
