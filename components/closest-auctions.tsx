import type { ClosestAuction } from "@/lib/analytics/closest-auctions";

const EUR0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? DATE_FMT.format(d) : iso;
}

function fmtSurface(s: number | null): string {
  if (s == null) return "—";
  return `${Math.round(s).toLocaleString("fr-FR")} m²`;
}

function scopeBadge(scope: ClosestAuction["scope"]): {
  label: string;
  className: string;
} {
  switch (scope) {
    case "city":
      return {
        label: "Même commune",
        className:
          "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      };
    case "tribunal":
      return {
        label: "Même tribunal",
        className: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      };
    case "department":
      return {
        label: "Même département",
        className: "bg-slate-700/40 text-slate-400 border-slate-700",
      };
  }
}

/**
 * Decote relative to mise à prix — useful one-shot indicator on each row.
 * Returns a string like "+225 %" or "+5 %" (always vs MAP, can be negative
 * for the rare case adj < MAP, which means folle enchère / re-vente).
 */
function discountVsMap(map: number, adj: number): string {
  if (!map || !adj) return "—";
  const r = adj / map - 1;
  const sign = r >= 0 ? "+" : "−";
  return `${sign}${Math.round(Math.abs(r) * 100)} %`;
}

export function ClosestAuctionsCard({
  closest,
}: {
  closest: ClosestAuction[];
}) {
  if (!closest || closest.length === 0) return null;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Ventes similaires récentes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {closest.length} comp{closest.length > 1 ? "s" : ""} du même type
            de bien — adjugées dans le secteur.
          </p>
        </div>
      </header>

      {/* Desktop / tablet: table */}
      <div className="hidden md:block overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
              <th className="px-2 py-2 text-left font-medium">Date</th>
              <th className="px-2 py-2 text-left font-medium">Ville</th>
              <th className="px-2 py-2 text-right font-medium">Surface</th>
              <th className="px-2 py-2 text-right font-medium">MAP</th>
              <th className="px-2 py-2 text-right font-medium">Adjugé</th>
              <th className="px-2 py-2 text-right font-medium">vs MAP</th>
              <th className="px-2 py-2 text-center font-medium">Proximité</th>
              <th className="px-2 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {closest.map((c) => {
              const b = scopeBadge(c.scope);
              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-800 last:border-b-0 hover:bg-slate-900/40 transition-colors"
                >
                  <td className="px-2 py-2.5 text-slate-400 tabular-nums whitespace-nowrap">
                    {fmtDate(c.auctionDate)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-300 truncate max-w-[12rem]">
                    {c.city ?? "—"}
                  </td>
                  <td className="px-2 py-2.5 text-slate-400 text-right tabular-nums">
                    {fmtSurface(c.surface)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-400 text-right tabular-nums">
                    {EUR0.format(c.miseAPrix)}
                  </td>
                  <td className="px-2 py-2.5 text-white text-right tabular-nums font-semibold">
                    {EUR0.format(c.adjudication)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-xs tabular-nums">
                    <span
                      className={
                        c.adjudication >= c.miseAPrix
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }
                    >
                      {discountVsMap(c.miseAPrix, c.adjudication)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${b.className}`}
                    >
                      {b.label}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:underline whitespace-nowrap text-xs"
                      >
                        Voir →
                      </a>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="md:hidden space-y-2.5">
        {closest.map((c) => {
          const b = scopeBadge(c.scope);
          return (
            <li
              key={c.id}
              className="rounded-xl border border-slate-700 bg-slate-900/40 p-3"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {c.city ?? "—"}
                  </p>
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    {fmtDate(c.auctionDate)} · {fmtSurface(c.surface)}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${b.className}`}
                >
                  {b.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-2">
                <div>
                  <p className="text-[10px] text-slate-500">Adjugé</p>
                  <p className="text-base font-semibold text-white tabular-nums">
                    {EUR0.format(c.adjudication)}
                    <span
                      className={`ml-1.5 text-xs font-normal ${
                        c.adjudication >= c.miseAPrix
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {discountVsMap(c.miseAPrix, c.adjudication)}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">MAP</p>
                  <p className="text-sm text-slate-400 tabular-nums">
                    {EUR0.format(c.miseAPrix)}
                  </p>
                </div>
              </div>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2.5 text-center text-xs text-orange-400 hover:underline"
                >
                  Voir l&apos;annonce →
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] text-slate-600 mt-3">
        Pondéré : commune &gt; tribunal &gt; département. Données licitor.com
        normalisées · indicatif.
      </p>
    </div>
  );
}
