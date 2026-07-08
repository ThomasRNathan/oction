"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Investor-contact server action. NOT a subscription/payment flow — it records
 * a contact request from a self-declared *investisseur averti* and the operator
 * follows up off-platform.
 */
const LeadSchema = z.object({
  nom: z.string().trim().min(2, "Indiquez votre nom (2 caractères min.)."),
  email: z.email("Adresse e-mail invalide."),
  telephone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
});

export interface LeadFormState {
  ok?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
}

export async function submitInvestorLead(
  _prev: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  // Self-attestation gate (averti) + RGPD consent — enforced server-side, not
  // just in the UI.
  if (formData.get("averti") !== "on") {
    return {
      errors: {
        averti: ["Vous devez certifier être un investisseur averti."],
      },
    };
  }
  if (formData.get("consent") !== "on") {
    return { errors: { consent: ["Votre consentement est requis."] } };
  }

  const parsed = LeadSchema.safeParse({
    nom: String(formData.get("nom") ?? ""),
    email: String(formData.get("email") ?? ""),
    telephone: String(formData.get("telephone") ?? "").trim() || undefined,
    message: String(formData.get("message") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { errors };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      message:
        "Service momentanément indisponible. Réessayez plus tard ou écrivez-nous directement.",
    };
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.from("leads").insert({
    nom: parsed.data.nom,
    email: parsed.data.email,
    telephone: parsed.data.telephone ?? null,
    message: parsed.data.message ?? null,
    source: "investisseur",
    averti: true,
  });
  if (error) {
    console.error("lead insert failed:", error.message);
    return {
      message:
        "L'enregistrement a échoué. Réessayez ou contactez-nous directement.",
    };
  }

  return { ok: true };
}
