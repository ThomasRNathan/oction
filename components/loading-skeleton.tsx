"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Connexion à licitor.com",
  "Lecture de l'annonce",
  "Extraction de la surface",
  "Géocodage de l'adresse",
  "Interrogation des données DVF",
  "Calcul du prix au m²",
  "Estimation de la liquidité",
  "Analyse de l'attractivité",
  "Simulation de financement",
  "Finalisation du rapport",
];

// Percentage each step settles at (last stays < 100 until the result lands).
const PCT = [5, 15, 28, 40, 52, 65, 75, 84, 92, 98];

const R = 82;
const CIRC = 2 * Math.PI * R;

export function LoadingSkeleton() {
  const [stepIndex, setStepIndex] = useState(0);
  const [displayPct, setDisplayPct] = useState(0);

  // Advance the step every ~2.8s.
  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Ease the percentage counter toward the current step's target.
  const targetPct = PCT[stepIndex];
  useEffect(() => {
    const tick = setInterval(() => {
      setDisplayPct((cur) => {
        if (cur >= targetPct) {
          clearInterval(tick);
          return cur;
        }
        return Math.min(cur + 1, targetPct);
      });
    }, 22);
    return () => clearInterval(tick);
  }, [targetPct]);

  const offset = CIRC * (1 - displayPct / 100);

  return (
    <div className="max-w-md mx-auto py-14 flex flex-col items-center text-center">
      {/* Circular progress ring */}
      <div className="relative h-52 w-52">
        <div className="absolute inset-6 rounded-full bg-orange-500/10 blur-2xl" />
        <svg viewBox="0 0 200 200" className="relative h-full w-full -rotate-90">
          <defs>
            <linearGradient id="ld-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fcd34d" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r={R} fill="none" stroke="#1e293b" strokeWidth="7" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="url(#ld-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black tabular-nums text-gradient leading-none">
            {displayPct}
            <span className="text-2xl align-top">%</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mt-2">
            Analyse
          </span>
        </div>
      </div>

      {/* Current step */}
      <div className="mt-8 flex items-center justify-center gap-2.5 h-6">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
        </span>
        <span className="text-slate-300 font-medium">{STEPS[stepIndex]}…</span>
      </div>

      {/* Step log */}
      <ul className="mt-6 w-full max-w-xs space-y-1.5 text-left">
        {STEPS.slice(0, stepIndex + 1).map((label, i) => {
          const done = i < stepIndex;
          return (
            <li
              key={i}
              className={`flex items-center gap-2.5 text-xs transition-colors ${
                done ? "text-slate-500" : "text-slate-300"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                  done
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-orange-500/40 bg-orange-500/10 text-orange-400"
                }`}
              >
                {done ? "✓" : "•"}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
