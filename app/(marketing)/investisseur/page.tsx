import type { Metadata } from "next";
import { InvestorForm } from "@/components/marketing/investor-form";
import { DISCLAIMER } from "@/lib/compliance";

export const metadata: Metadata = {
  title: "Espace investisseur",
  description:
    "Espace réservé aux investisseurs avertis. Présentez votre profil et vos critères pour être informé des dossiers éligibles. Ni offre au public, ni conseil en investissement.",
  alternates: { canonical: "/investisseur" },
};

export default function InvestisseurPage() {
  return (
    <main className="relative z-10 max-w-3xl mx-auto px-4 py-16">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-2">
          Espace investisseur
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight text-balance">
          Prendre contact
        </h1>
        <p className="text-slate-400 mt-3 max-w-xl">
          Cet espace est réservé aux investisseurs avertis. Il ne s&apos;agit
          ni d&apos;un abonnement, ni d&apos;une souscription : vous présentez
          votre profil, nous revenons vers vous sur les dossiers correspondants.
        </p>
      </div>

      {/* Reminder banner before the form */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-8">
        <p className="text-xs text-slate-400 leading-relaxed">{DISCLAIMER}</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 ring-gradient-on p-6 md:p-8">
        <InvestorForm />
      </div>
    </main>
  );
}
