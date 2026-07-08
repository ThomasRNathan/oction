"use client";

import { useActionState, useState } from "react";
import { submitInvestorLead, type LeadFormState } from "@/lib/leads/actions";
import { AVERTI_ATTESTATION } from "@/lib/compliance";

const INITIAL: LeadFormState = {};

const inputClass =
  "w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-sm";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-red-400 mt-1">{errors[0]}</p>;
}

export function InvestorForm() {
  const [state, action, pending] = useActionState(submitInvestorLead, INITIAL);
  const [averti, setAverti] = useState(false);
  const [consent, setConsent] = useState(false);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <p className="text-2xl mb-2">✓</p>
        <h2 className="text-lg font-semibold text-white">Demande envoyée</h2>
        <p className="text-sm text-slate-300 mt-1">
          Merci. Nous revenons vers vous si votre profil correspond aux dossiers
          en cours.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nom" className="block text-xs font-medium text-slate-400 mb-1.5">
            Nom <span className="text-orange-400">*</span>
          </label>
          <input id="nom" name="nom" required className={inputClass} placeholder="Jean Dupont" />
          <FieldError errors={state.errors?.nom} />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">
            E-mail <span className="text-orange-400">*</span>
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} placeholder="vous@exemple.com" />
          <FieldError errors={state.errors?.email} />
        </div>
      </div>

      <div>
        <label htmlFor="telephone" className="block text-xs font-medium text-slate-400 mb-1.5">
          Téléphone <span className="text-slate-600">(facultatif)</span>
        </label>
        <input id="telephone" name="telephone" type="tel" autoComplete="tel" className={inputClass} placeholder="06 12 34 56 78" />
        <FieldError errors={state.errors?.telephone} />
      </div>

      <div>
        <label htmlFor="message" className="block text-xs font-medium text-slate-400 mb-1.5">
          Vos critères <span className="text-slate-600">(type de biens, secteurs, horizon…)</span>
        </label>
        <textarea id="message" name="message" rows={4} className={inputClass} placeholder="Ce que vous recherchez." />
        <FieldError errors={state.errors?.message} />
      </div>

      {/* Self-attestation gate */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="averti"
          checked={averti}
          onChange={(e) => setAverti(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-orange-500 flex-shrink-0"
        />
        <span className="text-xs text-slate-400 leading-relaxed">{AVERTI_ATTESTATION}</span>
      </label>
      <FieldError errors={state.errors?.averti} />

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-orange-500 flex-shrink-0"
        />
        <span className="text-xs text-slate-400 leading-relaxed">
          J&apos;accepte d&apos;être recontacté(e) au sujet de ma demande. Mes
          données ne sont utilisées qu&apos;à cette fin.
        </span>
      </label>
      <FieldError errors={state.errors?.consent} />

      {state.message && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={!averti || !consent || pending}
        className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {pending ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}
