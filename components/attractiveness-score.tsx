"use client";

import { AttractivenessScore } from "@/lib/types";

interface Props {
  attractiveness: AttractivenessScore;
}

export function AttractivenessCard({ attractiveness }: Props) {
  const { score, label, color, details } = attractiveness;
  const pct = (score / 10) * 100;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        Attractivité du lot
      </h2>

      {/* Score gauge */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke="#1e293b"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black" style={{ color }}>
              {score.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-500">/10</span>
          </div>
        </div>

        <div>
          <p className="text-xl font-bold" style={{ color }}>{label}</p>
          <p className="text-xs text-slate-500 mt-1">
            Estimation de la concurrence lors des enchères
          </p>
        </div>
      </div>

      {/* Detail pills */}
      <div className="space-y-2">
        {details.map((d, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              background:
                d.impact === "positive"
                  ? "rgba(34,197,94,0.08)"
                  : d.impact === "negative"
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(100,116,139,0.08)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <span>
                {d.impact === "positive" ? "▲" : d.impact === "negative" ? "▼" : "●"}
              </span>
              <span
                className={
                  d.impact === "positive"
                    ? "text-green-400"
                    : d.impact === "negative"
                    ? "text-red-400"
                    : "text-slate-400"
                }
              >
                {d.label}
              </span>
            </span>
            <span className="text-slate-500 text-right">{d.value}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] text-slate-600 text-center">
        Score indicatif · basé sur les paramètres visibles · non garanti
      </p>
    </div>
  );
}
