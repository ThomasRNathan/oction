"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { pct: 5,  label: "Connexion à licitor.com…",          icon: "🔗" },
  { pct: 15, label: "Lecture de l'annonce…",              icon: "📄" },
  { pct: 28, label: "Extraction de la surface…",          icon: "📐" },
  { pct: 40, label: "Géocodage de l'adresse…",            icon: "📍" },
  { pct: 52, label: "Interrogation des données DVF…",     icon: "🏦" },
  { pct: 65, label: "Calcul du prix au m²…",              icon: "📊" },
  { pct: 75, label: "Estimation de la liquidité…",        icon: "💧" },
  { pct: 84, label: "Analyse de l'attractivité…",         icon: "⭐" },
  { pct: 92, label: "Simulation de financement…",         icon: "💶" },
  { pct: 98, label: "Finalisation du rapport…",           icon: "✅" },
];

export function LoadingSkeleton() {
  const [stepIndex, setStepIndex] = useState(0);
  const [displayPct, setDisplayPct] = useState(0);

  // Advance steps every ~2.8s
  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Smoothly animate the percentage counter
  const targetPct = STEPS[stepIndex].pct;
  useEffect(() => {
    const tick = setInterval(() => {
      setDisplayPct((cur) => {
        if (cur >= targetPct) { clearInterval(tick); return cur; }
        return Math.min(cur + 1, targetPct);
      });
    }, 30);
    return () => clearInterval(tick);
  }, [targetPct]);

  const step = STEPS[stepIndex];

  return (
    <div className="max-w-xl mx-auto text-center py-12 space-y-8">
      {/* Big percentage */}
      <div className="relative">
        <p
          className="text-8xl font-black tabular-nums"
          style={{
            background: "linear-gradient(135deg, #fb923c, #ef4444, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {displayPct}%
        </p>
        <p className="text-slate-500 text-xs mt-1 tracking-widest uppercase">
          Analyse en cours
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${displayPct}%`,
            background: "linear-gradient(90deg, #fb923c, #ef4444, #a855f7)",
          }}
        />
      </div>

      {/* Current step */}
      <div className="flex items-center justify-center gap-3 h-10">
        <span className="text-2xl">{step.icon}</span>
        <span className="text-slate-300 font-medium text-lg animate-pulse">
          {step.label}
        </span>
      </div>

      {/* Completed steps log */}
      <div className="text-left space-y-1 max-h-36 overflow-hidden">
        {STEPS.slice(0, stepIndex).map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="text-green-500/70">✓</span>
            <span>{s.label.replace("…", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
