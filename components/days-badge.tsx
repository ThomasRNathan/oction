/**
 * "J-N" countdown pill. Red today, orange ≤ 7 j, amber ≤ 30 j, slate beyond.
 * Renders nothing for null/past dates.
 */
export function DaysBadge({ days }: { days: number | null }) {
  if (days == null || days < 0) return null;

  let text: string;
  let className: string;
  if (days === 0) {
    text = "Aujourd'hui";
    className = "bg-red-500/15 text-red-300 border-red-500/30";
  } else if (days <= 7) {
    text = `J-${days}`;
    className = "bg-orange-500/15 text-orange-300 border-orange-500/30";
  } else if (days <= 30) {
    text = `J-${days}`;
    className = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  } else {
    text = `J-${days}`;
    className = "bg-slate-700/40 text-slate-400 border-slate-700";
  }

  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${className}`}
    >
      {text}
    </span>
  );
}
