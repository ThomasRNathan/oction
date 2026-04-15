"use client";

import { useState, useEffect } from "react";
import { FinancingSimulation } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

interface FinancingSimulatorProps {
  miseAPrix: number;
  initialFinancing?: FinancingSimulation;
  onUpdate?: (rate: number, duration: number) => void;
}

function computeLocal(
  amount: number,
  ratePercent: number,
  durationYears: number
): FinancingSimulation {
  const notaryFees = amount * 0.075;
  const loanAmount = amount + notaryFees;
  const monthlyRate = ratePercent / 100 / 12;
  const n = durationYears * 12;

  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = loanAmount / n;
  } else {
    monthlyPayment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) /
      (Math.pow(1 + monthlyRate, n) - 1);
  }

  const totalCost = monthlyPayment * n;

  return {
    loanAmount: Math.round(loanAmount),
    rate: ratePercent,
    durationYears,
    monthlyPayment: Math.round(monthlyPayment),
    totalCost: Math.round(totalCost),
    totalInterest: Math.round(totalCost - loanAmount),
  };
}

export function FinancingSimulator({
  miseAPrix,
  initialFinancing,
}: FinancingSimulatorProps) {
  const [rate, setRate] = useState(initialFinancing?.rate ?? 3.5);
  const [duration, setDuration] = useState(
    initialFinancing?.durationYears ?? 20
  );
  const [bidAmount, setBidAmount] = useState(miseAPrix);
  const [sim, setSim] = useState<FinancingSimulation>(
    initialFinancing ?? computeLocal(miseAPrix, 3.5, 20)
  );

  useEffect(() => {
    setSim(computeLocal(bidAmount, rate, duration));
  }, [bidAmount, rate, duration]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        Simulateur de financement
      </h2>

      <div className="space-y-5">
        {/* Bid amount slider */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Montant estimé d&apos;achat</span>
            <span className="text-white font-medium">{fmt(bidAmount)} EUR</span>
          </div>
          <input
            type="range"
            min={miseAPrix}
            max={Math.round(miseAPrix * 3)}
            step={1000}
            value={bidAmount}
            onChange={(e) => setBidAmount(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>Mise à prix ({fmt(miseAPrix)})</span>
            <span>x3 ({fmt(miseAPrix * 3)})</span>
          </div>
        </div>

        {/* Rate slider */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Taux d&apos;intérêt</span>
            <span className="text-white font-medium">{rate.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={7}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>1%</span>
            <span>7%</span>
          </div>
        </div>

        {/* Duration slider */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Durée</span>
            <span className="text-white font-medium">{duration} ans</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>5 ans</span>
            <span>30 ans</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-6 pt-5 border-t border-slate-700">
        <div className="text-center mb-4">
          <p className="text-sm text-slate-500">Mensualité</p>
          <p className="text-4xl font-black text-purple-400">
            {fmt(sim.monthlyPayment)}{" "}
            <span className="text-lg text-slate-400">EUR/mois</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-900/50 rounded-xl p-3 text-center">
            <p className="text-slate-500 text-xs">Montant emprunté</p>
            <p className="text-white font-semibold">{fmt(sim.loanAmount)} EUR</p>
            <p className="text-slate-600 text-xs">
              dont {fmt(Math.round(bidAmount * 0.075))} EUR frais notaire
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-3 text-center">
            <p className="text-slate-500 text-xs">Coût total du crédit</p>
            <p className="text-white font-semibold">{fmt(sim.totalCost)} EUR</p>
            <p className="text-slate-600 text-xs">
              dont {fmt(sim.totalInterest)} EUR intérêts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
