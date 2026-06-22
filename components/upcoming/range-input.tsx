"use client";

/**
 * Min/max numeric range filter used by the upcoming-auctions filter bar.
 *
 * UX: two thin inputs side-by-side with a single label above. Empty inputs
 * mean "no bound on this side". The component reports `null` when an input is
 * cleared and a finite number when the user typed one — this maps cleanly to
 * the `mapMin / mapMax / dvfMin / dvfMax` query params on /api/upcoming.
 *
 * Why not a slider: the value range spans 4 orders of magnitude (€1 k parking
 * → €5 M immeuble) so a linear slider is unusable. Direct numeric input is
 * faster for a power-user investor.
 */
interface Props {
  label: string;
  min: number | null;
  max: number | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
  /** Placeholder hint values, typically the observed pool min/max. */
  hintMin?: number | null;
  hintMax?: number | null;
  /** Width on the wrapping flex container. */
  width?: string;
  /** Suffix shown after each input (e.g. "€"). */
  suffix?: string;
}

function fmtHint(n: number | null | undefined): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function parseInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return null;
  // Accept "300k" / "1.2M" shorthand
  const m = /^(\d+(?:\.\d+)?)([kKmM])?$/.exec(trimmed);
  if (m) {
    const base = Number(m[1]);
    const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
    return Number.isFinite(base) ? base * mult : null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function RangeInput({
  label,
  min,
  max,
  onChange,
  hintMin,
  hintMax,
  width = "min-w-[180px]",
  suffix = "€",
}: Props) {
  const active = min != null || max != null;

  const minStr = min != null ? String(min) : "";
  const maxStr = max != null ? String(max) : "";

  return (
    <div className={`flex flex-col gap-1 ${width}`}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
        {suffix && <span className="ml-1 text-slate-600 normal-case">({suffix})</span>}
      </span>
      <div className="flex items-stretch gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={minStr}
          onChange={(e) => onChange({ min: parseInput(e.target.value), max })}
          placeholder={hintMin != null ? `≥ ${fmtHint(hintMin)}` : "min"}
          className={
            "w-full px-2.5 py-2 bg-slate-800/70 border rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 tabular-nums transition-colors " +
            (min != null ? "border-orange-500/60" : "border-slate-700")
          }
        />
        <span className="self-center text-slate-600 text-xs select-none">–</span>
        <input
          type="text"
          inputMode="decimal"
          value={maxStr}
          onChange={(e) => onChange({ min, max: parseInput(e.target.value) })}
          placeholder={hintMax != null ? `≤ ${fmtHint(hintMax)}` : "max"}
          className={
            "w-full px-2.5 py-2 bg-slate-800/70 border rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 tabular-nums transition-colors " +
            (max != null ? "border-orange-500/60" : "border-slate-700")
          }
        />
        {active && (
          <button
            type="button"
            onClick={() => onChange({ min: null, max: null })}
            className="px-2 text-slate-500 hover:text-white text-xs"
            aria-label={`Effacer ${label}`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
