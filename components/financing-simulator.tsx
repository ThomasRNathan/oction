"use client";

import { useState, useEffect } from "react";
import { FinancingSimulation } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

interface FinancingSimulatorProps {
  miseAPrix: number;
  initialFinancing?: FinancingSimulation;
}

/** Émoluments du commissaire de justice (barème légal) */
function computeEmoluments(price: number): number {
  let emol = 0;
  if (price <= 6500) {
    emol = price * 0.0725;
  } else if (price <= 17000) {
    emol = 6500 * 0.0725 + (price - 6500) * 0.0299;
  } else if (price <= 60000) {
    emol = 6500 * 0.0725 + 10500 * 0.0299 + (price - 17000) * 0.0199;
  } else {
    emol =
      6500 * 0.0725 +
      10500 * 0.0299 +
      43000 * 0.0199 +
      (price - 60000) * 0.0149;
  }
  return Math.round(emol);
}

interface FeeBreakdown {
  fraisPrealable: number;
  emoluments: number;
  droitEnregistrement: number;
  fraisPublication: number;
  divers: number;
  avocat: number;
  total: number;
}

function computeFees(price: number, fraisPrealable: number): FeeBreakdown {
  const emoluments = computeEmoluments(price);
  const droitEnregistrement = Math.round(price * 0.058);
  const fraisPublication = Math.round(price * 0.001);
  const divers = 150;
  const avocat = 1750; // ~1500-2000€ si adjudicataire
  const total =
    fraisPrealable +
    emoluments +
    droitEnregistrement +
    fraisPublication +
    divers +
    avocat;
  return {
    fraisPrealable,
    emoluments,
    droitEnregistrement,
    fraisPublication,
    divers,
    avocat,
    total,
  };
}

function computeLocal(
  amount: number,
  fees: FeeBreakdown,
  ratePercent: number,
  durationYears: number
): FinancingSimulation {
  const loanAmount = amount + fees.total;
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
  const [fraisPrealable, setFraisPrealable] = useState(12000);
  const [showFees, setShowFees] = useState(false);

  const fees = computeFees(bidAmount, fraisPrealable);
  const sim = computeLocal(bidAmount, fees, rate, duration);

  // reset bid when miseAPrix prop changes
  useEffect(() => {
    setBidAmount(miseAPrix);
  }, [miseAPrix]);

  const chequebanque = Math.max(3000, Math.round(bidAmount * 0.1));

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
            <span className="text-slate-500">Montant d&apos;adjudication estimé</span>
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

      {/* Fee breakdown accordion */}
      <div className="mt-5 rounded-xl border border-slate-700 overflow-hidden">
        <button
          onClick={() => setShowFees((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 text-sm text-slate-300 hover:bg-slate-900/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="text-orange-400">⚖</span>
            Frais d&apos;enchères judiciaires
            <span className="text-orange-400 font-semibold">
              +{fmt(fees.total)} EUR
            </span>
          </span>
          <span className="text-slate-500 text-xs">{showFees ? "▲" : "▼"}</span>
        </button>

        {showFees && (
          <div className="px-4 py-3 space-y-2 bg-slate-900/30 text-xs">
            {/* Frais préalable slider */}
            <div className="mb-3">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Frais préalables (saisie, diag…)</span>
                <span className="text-slate-200 font-medium">
                  {fmt(fraisPrealable)} EUR
                </span>
              </div>
              <input
                type="range"
                min={5000}
                max={20000}
                step={500}
                value={fraisPrealable}
                onChange={(e) => setFraisPrealable(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-400"
              />
              <div className="flex justify-between text-slate-600 mt-0.5">
                <span>5 000</span>
                <span>8–15 k€ estimé</span>
                <span>20 000</span>
              </div>
            </div>

            <FeeRow
              label="Émoluments du commissaire"
              note="barème légal dégressif"
              value={fees.emoluments}
            />
            <FeeRow
              label="Droit d'enregistrement"
              note="5,8% du prix"
              value={fees.droitEnregistrement}
            />
            <FeeRow
              label="Frais de publication"
              note="0,10% du prix"
              value={fees.fraisPublication}
            />
            <FeeRow label="Frais divers" note="≈ forfait" value={fees.divers} />
            <FeeRow
              label="Avocat (si adjudicataire)"
              note="1 500–2 000 €"
              value={fees.avocat}
            />

            <div className="border-t border-slate-700 pt-2 flex justify-between text-slate-200 font-semibold">
              <span>Total frais</span>
              <span className="text-orange-400">{fmt(fees.total)} EUR</span>
            </div>

            {/* Chèque banque reminder */}
            <div className="mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              <span className="font-semibold">Chèque de banque jour J :</span>{" "}
              {fmt(chequebanque)} EUR{" "}
              <span className="text-yellow-600">(10% du prix, min 3 000€)</span>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mt-5 pt-5 border-t border-slate-700">
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
              dont {fmt(fees.total)} EUR frais enchères
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

function FeeRow({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: number;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-400">
        {label}{" "}
        <span className="text-slate-600 text-[10px]">({note})</span>
      </span>
      <span className="text-slate-300 font-medium tabular-nums">
        {fmt(value)} €
      </span>
    </div>
  );
}
