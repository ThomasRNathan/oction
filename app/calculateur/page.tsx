"use client";

import { useMemo, useState } from "react";
import {
  computeFees,
  DEFAULT_DMTO_RATE,
  type AuctionFeesBreakdown,
} from "@/lib/calculateur/french-auction-fees";

/* ──────────────────────────────────────────────────────────────────────
   Formatters
   ────────────────────────────────────────────────────────────────────── */

const EUR0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const PCT2 = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtEUR = (n: number) => EUR0.format(n);
const fmtPct = (n: number) => PCT2.format(n);

/* ──────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────── */

export default function CalculateurPage() {
  const [adjudication, setAdjudication] = useState<number | "">("");
  const [miseAPrix, setMiseAPrix] = useState<number | "">("");
  const [surface, setSurface] = useState<number | "">("");
  const [dmtoRatePct, setDmtoRatePct] = useState<number>(
    +(DEFAULT_DMTO_RATE * 100).toFixed(2)
  );
  const [fraisPrealables, setFraisPrealables] = useState<number>(2500);

  const breakdown: AuctionFeesBreakdown | null = useMemo(() => {
    if (typeof adjudication !== "number" || adjudication <= 0) return null;
    return computeFees({
      adjudication,
      dmtoRate: dmtoRatePct / 100,
      fraisPrealables,
      miseAPrix:
        typeof miseAPrix === "number" && miseAPrix > 0 ? miseAPrix : undefined,
    });
  }, [adjudication, dmtoRatePct, fraisPrealables, miseAPrix]);

  const pricePerSqm =
    breakdown && typeof surface === "number" && surface > 0
      ? breakdown.allIn / surface
      : null;

  return (
    <main className="min-h-screen bg-[#0a0f1a] overflow-x-hidden">
      {/* Ambient blobs (match the home / historique pages) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-orange-500/8 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/6 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-10 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">
            Calculateur d&apos;adjudication
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Estimez le coût total d&apos;une vente aux enchères judiciaire en
            France : émoluments d&apos;avocat poursuivant, droits d&apos;enregistrement
            (DMTO), contribution de sécurité immobilière et frais préalables.
          </p>
        </header>

        {/* Inputs */}
        <section className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Paramètres</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberField
              label="Prix d'adjudication"
              suffix="€"
              value={adjudication}
              onChange={setAdjudication}
              placeholder="Ex. 150 000"
            />
            <NumberField
              label="Mise à prix"
              suffix="€"
              value={miseAPrix}
              onChange={setMiseAPrix}
              placeholder="Ex. 80 000"
              hint="Sert au calcul de la caution"
              optional
            />
            <NumberField
              label="Droits d'enregistrement (DMTO)"
              suffix="%"
              value={dmtoRatePct}
              onChange={(v) => setDmtoRatePct(typeof v === "number" ? v : 0)}
              step="0.01"
              hint="5,81 % par défaut · 6,32 % dans la plupart des départements depuis 2025"
            />
            <NumberField
              label="Frais préalables"
              suffix="€"
              value={fraisPrealables}
              onChange={(v) =>
                setFraisPrealables(typeof v === "number" ? v : 0)
              }
              hint="Fixés par le cahier des conditions de vente"
            />
            <NumberField
              label="Surface"
              suffix="m²"
              value={surface}
              onChange={setSurface}
              placeholder="Ex. 45"
              hint="Affiche le coût total au m²"
              optional
            />
          </div>
        </section>

        {/* Results */}
        {!breakdown ? (
          <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm">
            Renseignez un prix d&apos;adjudication pour obtenir l&apos;estimation.
          </div>
        ) : (
          <>
            {/* All-in summary card */}
            <section className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent p-6 md:p-8">
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-2">
                Coût total estimé
              </p>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <div className="text-3xl md:text-4xl font-black text-white tabular-nums leading-tight">
                    {fmtEUR(breakdown.allIn)}
                  </div>
                  <div className="text-sm text-slate-400 mt-1.5">
                    Frais d&apos;adjudication :{" "}
                    <span className="text-white font-semibold">
                      {fmtEUR(breakdown.totalFees)}
                    </span>{" "}
                    · soit{" "}
                    <span className="text-white font-semibold">
                      {fmtPct(breakdown.feeRate)}
                    </span>{" "}
                    du prix d&apos;adjudication
                  </div>
                </div>
                {pricePerSqm !== null && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {fmtEUR(pricePerSqm)}
                      <span className="text-slate-400 text-sm font-normal">
                        {" "}/ m²
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Tout compris ({surface} m²)
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Detailed breakdown */}
            <section className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-4">
                Détail du calcul
              </h2>
              <div className="space-y-2">
                <Row
                  label="Prix d'adjudication"
                  amount={breakdown.adjudication}
                  muted
                />
                <Divider />
                <Row
                  label="Émoluments d'avocat HT"
                  hint="Tarif réglementé : 7 % / 3 % / 2 % / 1 % par tranche (art. A.444-191 C. com.)"
                  amount={breakdown.emolumentsHT}
                />
                <Row
                  label="TVA 20 % sur émoluments"
                  amount={breakdown.emolumentsTVA}
                />
                <Row
                  label="Émoluments TTC"
                  amount={breakdown.emolumentsTTC}
                  bold
                />
                <Divider />
                <Row
                  label="Droits d'enregistrement (DMTO)"
                  hint={`${fmtPct(breakdown.dmtoRate)} du prix d'adjudication`}
                  amount={breakdown.droitsEnregistrement}
                />
                <Row
                  label="Contribution de sécurité immobilière"
                  hint="0,10 % du prix d'adjudication"
                  amount={breakdown.contributionSecurite}
                />
                <Row
                  label="Frais préalables"
                  hint="Forfait fixé par le cahier des conditions"
                  amount={breakdown.fraisPrealables}
                />
                <Divider />
                <Row label="Total des frais" amount={breakdown.totalFees} bold accent />
                <Row
                  label="Coût total (adjudication + frais)"
                  amount={breakdown.allIn}
                  large
                />
              </div>
            </section>

            {/* Callouts */}
            <div className="grid md:grid-cols-2 gap-4">
              <Callout
                title="Seuil de surenchère"
                amount={breakdown.surenchereThreshold}
                description="Tout tiers peut surenchérir dans les 10 jours suivant l'adjudication, à condition de proposer au moins 10 % de plus. L'adjudicataire lui-même ne peut pas surenchérir."
              />
              {breakdown.caution !== undefined ? (
                <Callout
                  title="Caution / consignation"
                  amount={breakdown.caution}
                  description="Avant d'enchérir, votre avocat doit remettre un chèque de banque correspondant à 10 % minimum de la mise à prix (au moins 3 000 €). Restitué si vous n'êtes pas adjudicataire."
                />
              ) : (
                <Callout
                  title="Caution / consignation"
                  description="Indiquez la mise à prix pour estimer le chèque de banque exigé avant l'enchère (10 % de la mise à prix, minimum 3 000 €)."
                />
              )}
            </div>

            <p className="text-[10px] text-slate-600 text-center pt-2 max-w-2xl mx-auto leading-relaxed">
              Estimation indicative. Les émoluments d&apos;avocat suivent le
              tarif réglementé de l&apos;article A.444-191 du Code de commerce ·
              les taux DMTO varient selon le département et la nature du bien ·
              certains lots peuvent impliquer des coûts additionnels (TVA sur
              le prix, taxe foncière proratisée, état hypothécaire, expertises).
            </p>
          </>
        )}
      </div>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Subcomponents
   ────────────────────────────────────────────────────────────────────── */

function NumberField({
  label,
  suffix,
  value,
  onChange,
  placeholder,
  hint,
  optional,
  step,
}: {
  label: string;
  suffix: string;
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">
        {label}
        {optional && (
          <span className="text-slate-600 font-normal"> (facultatif)</span>
        )}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onChange("");
            else onChange(Number(v));
          }}
          className="w-full pl-4 pr-10 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-sm tabular-nums"
        />
        <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 pointer-events-none">
          {suffix}
        </span>
      </div>
      {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
    </label>
  );
}

function Row({
  label,
  hint,
  amount,
  bold,
  muted,
  accent,
  large,
}: {
  label: string;
  hint?: string;
  amount: number;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        large ? "pt-2" : ""
      }`}
    >
      <div className="flex flex-col min-w-0">
        <span
          className={`text-sm ${
            muted
              ? "text-slate-500"
              : large
                ? "text-white font-semibold"
                : bold
                  ? "text-white font-semibold"
                  : "text-slate-300"
          }`}
        >
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-slate-600 mt-0.5">{hint}</span>
        )}
      </div>
      <span
        className={`tabular-nums whitespace-nowrap ${
          large ? "text-xl font-bold" : "text-sm"
        } ${
          accent
            ? "text-orange-400 font-semibold"
            : muted
              ? "text-slate-500"
              : large
                ? "text-white"
                : bold
                  ? "text-white font-semibold"
                  : "text-slate-200"
        }`}
      >
        {EUR0.format(amount)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-800 my-1" />;
}

function Callout({
  title,
  amount,
  description,
}: {
  title: string;
  amount?: number;
  description: string;
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-5">
      <p className="text-xs text-slate-500 font-medium mb-1.5">{title}</p>
      {amount !== undefined ? (
        <p className="text-2xl font-bold text-white tabular-nums mb-2">
          {EUR0.format(amount)}
        </p>
      ) : (
        <p className="text-sm text-slate-600 italic mb-2">—</p>
      )}
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
