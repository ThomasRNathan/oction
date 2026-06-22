/**
 * Shared fr-FR display formatters. Each browse table used to carry its own
 * copies — new components import from here instead.
 */

export function fmtEuros(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(".", ",")} M€`;
  if (n >= 10_000) return `${Math.round(n / 1000)} k€`;
  return `${n.toLocaleString("fr-FR")} €`;
}

export function fmtSurface(s: number | null | undefined): string {
  if (s == null) return "—";
  return `${Math.round(s)} m²`;
}

/**
 * Mise à prix display. Upcoming rows indexed but not yet detail-scraped carry
 * a mise_a_prix of 0 — show "—" rather than a misleading "0 €".
 */
export function fmtMap(n: number | null | undefined): string {
  return n == null || n <= 0 ? "—" : fmtEuros(n);
}

/** ISO (date or timestamptz) → "12 juin 26". Returns "—" when absent/invalid. */
export function fmtDateIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

/** Signed percent with fr decimal comma: 0.034 → "+3,4 %". */
export function fmtPct(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null) return "—";
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits).replace(".", ",")} %`;
}

/**
 * MAP/DVF ratio → display pill. ratio 0.6 → "-40% vs DVF" (MAP at 60 % of the
 * DVF-expected price). Green = deep discount, amber = moderate, red = above
 * market.
 */
export function decoteVsDvf(ratio: number | null | undefined): {
  text: string;
  color: string;
} {
  if (ratio == null) return { text: "—", color: "text-slate-600" };
  const discount = 1 - ratio;
  const pct = Math.round(discount * 100);
  const text = `${pct >= 0 ? "-" : "+"}${Math.abs(pct)}% vs DVF`;
  let color = "text-slate-400";
  if (discount >= 0.4) color = "text-emerald-400";
  else if (discount >= 0.2) color = "text-amber-400";
  else if (discount < 0) color = "text-red-400";
  return { text, color };
}
