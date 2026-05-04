"use client";

import { useState } from "react";
import {
  AttractivenessScore,
  UncontestedScore,
  UncontestedScores,
} from "@/lib/types";
import type { UncontestedMode } from "@/lib/analytics/uncontested";

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

interface UncontestedProps {
  uncontested: UncontestedScores;
}

const TAB_LABELS: Record<UncontestedMode, string> = {
  exact: "Au prix plancher",
  soft: "≤ +5 %",
  market: "≥40 % sous marché",
};

const HEADER_FOR_MODE: Record<UncontestedMode, string> = {
  exact: "Probabilité d'adjuger pile au plancher",
  soft: "Probabilité de gagner sans surenchère",
  market: "Probabilité d'une décote ≥ 40 % sous marché",
};

/**
 * Probability gauge with a 3-mode segmented control:
 *   - exact:  adjudication = mise à prix
 *   - soft:   adjudication ≤ mise à prix +5 %      (default)
 *   - market: adjudication ≥ 40 % sous DVF        (greyed when DVF missing)
 *
 * Each mode reads from its own pre-baked rate table at module init time
 * (see lib/analytics/uncontested.ts). Switching tabs only swaps the data
 * source — no network call.
 */
export function UncontestedCard({ uncontested }: UncontestedProps) {
  const [mode, setMode] = useState<UncontestedMode>("soft");

  const marketAvailable = uncontested.market !== null;
  // If the user is on the market tab but it's not available (e.g. DVF missing),
  // fall back to "soft" silently — keeps the gauge meaningful.
  const effectiveMode: UncontestedMode =
    mode === "market" && !marketAvailable ? "soft" : mode;
  const active: UncontestedScore =
    effectiveMode === "market"
      ? (uncontested.market as UncontestedScore)
      : uncontested[effectiveMode];

  const { probability, baseline, label, color, details, sampleSize, caption } =
    active;
  const pct = probability * 100;
  const baselinePct = baseline * 100;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        {HEADER_FOR_MODE[effectiveMode]}
      </h2>

      {/* Mode segmented control */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["exact", "soft", "market"] as UncontestedMode[]).map((m) => {
          const isActive = effectiveMode === m;
          const isDisabled = m === "market" && !marketAvailable;
          return (
            <button
              key={m}
              type="button"
              onClick={() => !isDisabled && setMode(m)}
              disabled={isDisabled}
              title={isDisabled ? "DVF requis" : undefined}
              aria-pressed={isActive}
              className={
                isActive
                  ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm transition-all"
                  : isDisabled
                  ? "px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-800 text-slate-600 cursor-not-allowed transition-all"
                  : "px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
              }
            >
              {TAB_LABELS[m]}
              {isDisabled && (
                <span className="ml-1.5 text-[10px] text-slate-700">
                  (DVF requis)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Probability gauge */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="#1e293b"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.9"
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
              {pct.toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-500">%</span>
          </div>
        </div>

        <div>
          <p className="text-base font-bold leading-tight" style={{ color }}>
            {label}
          </p>
          <p className="text-xs text-slate-500 mt-1">{caption}</p>
          <p className="text-[10px] text-slate-600 mt-1">
            base de référence : {baselinePct.toFixed(1)} % sur{" "}
            {sampleSize.toLocaleString("fr-FR")} ventes
          </p>
        </div>
      </div>

      {/* Top contributing factors */}
      {details.length > 0 && (
        <div className="space-y-2">
          {details.map((d, i) => (
            <div
              key={`${effectiveMode}-${i}`}
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
                  {d.impact === "positive"
                    ? "▲"
                    : d.impact === "negative"
                    ? "▼"
                    : "●"}
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
      )}

      <p className="mt-4 text-[10px] text-slate-600 text-center">
        Probabilité empirique · basée sur les enchères passées · non garantie
      </p>
    </div>
  );
}
