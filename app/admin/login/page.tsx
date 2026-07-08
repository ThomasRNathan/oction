import type { Metadata } from "next";
import Link from "next/link";
import { signInWithEmail } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

/**
 * Magic-link sign-in for the admin tool. Ungated (sits outside the (tool)
 * group). On submit, Auth.js emails a Resend link and redirects here with
 * ?sent=1; a refused (non-allowlisted) address comes back with ?error.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const callbackUrl = sp.callbackUrl ?? "/admin";

  return (
    <main className="relative min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-dotgrid pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-2xl font-black bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent">
            OCTION
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
            Admin
          </span>
        </Link>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 ring-gradient-on rounded-2xl p-6">
          {sent ? (
            <div className="text-center space-y-2">
              <p className="text-2xl">📬</p>
              <h1 className="text-lg font-semibold text-white">Lien envoyé</h1>
              <p className="text-sm text-slate-400">
                Si cette adresse est autorisée, un lien de connexion vient de vous
                être envoyé. Vérifiez votre boîte mail.
              </p>
              <Link
                href="/admin/login"
                className="inline-block mt-3 text-xs text-orange-400 hover:underline"
              >
                Utiliser une autre adresse
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-white mb-1">
                Espace administrateur
              </h1>
              <p className="text-sm text-slate-500 mb-5">
                Connexion par lien magique. Accès réservé.
              </p>

              {sp.error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  Connexion impossible. Cette adresse n&apos;est pas autorisée.
                </div>
              )}

              <form action={signInWithEmail} className="space-y-3">
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-sm"
                />
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all text-sm"
                >
                  Recevoir le lien de connexion
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400">
            ← Retour au site
          </Link>
        </p>
      </div>
    </main>
  );
}
