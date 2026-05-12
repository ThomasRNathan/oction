"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/auth/browser";

interface Props {
  /** Hint shown above the form ("Connectez-vous pour voir l'analyse"). */
  reason?: string;
  /** Where to send the user after auth — passed through to the callback. */
  redirectTo?: string;
  /** Optional error code surfaced from /auth/callback. */
  errorCode?: string | null;
}

/**
 * Modal authentication gate.
 *
 * Rendered on top of a blurred result. Offers Google OAuth and email
 * magic-link sign-in. After the user clicks "Continuer", Supabase emails them
 * a link that lands on /auth/callback?code=… and sets the session cookie.
 *
 * UI-only gate: the API call has already happened and the result is in
 * memory. The blur + this modal exist to push the user to authenticate
 * before they can read the analysis.
 */
export function AuthGate({
  reason = "Connectez-vous pour voir l'analyse complète",
  redirectTo = "/",
  errorCode,
}: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState<"google" | "magic" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = (() => {
    if (typeof window === "undefined") return "";
    const url = new URL("/auth/callback", window.location.origin);
    if (redirectTo) url.searchParams.set("next", redirectTo);
    return url.toString();
  })();

  const onGoogle = async () => {
    setError(null);
    setSubmitting("google");
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
      // signInWithOAuth navigates away on success; nothing else to do.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur Google");
      setSubmitting(null);
    }
  };

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting("magic");
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: callbackUrl,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi du lien");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      {/* Backdrop — blocks interaction with the page beneath but doesn't
          fully obscure; the home page applies its own blur to the result. */}
      <div className="absolute inset-0 bg-[#0a0f1a]/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <h2
            id="auth-gate-title"
            className="text-lg font-bold text-white"
          >
            Analyse prête
          </h2>
          <p className="text-sm text-slate-400">{reason}</p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            ✉️ Lien envoyé à <span className="font-semibold">{email}</span>.
            Cliquez dessus pour vous connecter — vous reviendrez ici
            automatiquement.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onGoogle}
              disabled={submitting !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors text-sm"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                aria-hidden
              >
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.71-1.58 2.69-3.9 2.69-6.62z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 009 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.97 10.72A5.41 5.41 0 013.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0a9 9 0 00-8.04 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
                />
              </svg>
              {submitting === "google" ? "Redirection…" : "Continuer avec Google"}
            </button>

            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-600">
              <div className="flex-1 border-t border-slate-800" />
              ou
              <div className="flex-1 border-t border-slate-800" />
            </div>

            <form onSubmit={onMagicLink} className="space-y-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  disabled={submitting !== null}
                  className="w-full px-3 py-2 bg-slate-800/70 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                />
              </label>
              <button
                type="submit"
                disabled={submitting !== null || !email.trim()}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all text-sm"
              >
                {submitting === "magic"
                  ? "Envoi…"
                  : "Recevoir un lien de connexion"}
              </button>
            </form>
          </>
        )}

        {(error || errorCode) && !sent && (
          <p className="text-xs text-red-400">
            {error ?? `Échec de la connexion (${errorCode}). Réessayez.`}
          </p>
        )}

        <p className="text-[10px] text-slate-600 text-center">
          En vous connectant, vous acceptez que vos analyses soient sauvegardées
          dans votre compte.
        </p>
      </div>
    </div>
  );
}
