import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { SupabaseAdapter } from "@auth/supabase-adapter";

/**
 * Auth.js v5 config for the private /admin tool.
 *
 * - Sign-in is a **Resend email magic link** (passwordless). Verification
 *   tokens + the user row persist in Supabase (the `next_auth` schema — see
 *   docs/AUTH-SETUP.md for the one-time schema migration + exposed-schema step).
 * - This is a **closed admin gate**, not open signup: only emails in
 *   AUTH_ALLOWLIST may complete sign-in. Empty allowlist = deny everyone
 *   (fail-closed), so a missing env var can never silently open the door.
 * - Sessions are JWT so `proxy.ts` can gate `/admin` without a DB round-trip;
 *   the secure check still runs server-side via lib/auth/dal.ts.
 */
const ALLOWLIST = (process.env.AUTH_ALLOWLIST ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter:
    supabaseUrl && supabaseServiceKey
      ? SupabaseAdapter({ url: supabaseUrl, secret: supabaseServiceKey })
      : undefined,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? "Oction <login@oction.fr>",
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/login",
    verifyRequest: "/admin/login?sent=1",
    error: "/admin/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      return ALLOWLIST.includes(email);
    },
  },
  trustHost: true,
});
