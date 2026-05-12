/**
 * Server-side Supabase client with cookie-backed session.
 *
 * Use from Route Handlers, Server Components, and Server Actions. In this
 * Next.js version `cookies()` is async, so this helper must be `await`-ed.
 *
 * The cookie methods are wired so Supabase Auth can keep the session token
 * fresh: read on every request, write back on token refresh.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getServerSupabase(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        // In Server Components Next.js disallows mutation; the try/catch lets
        // those callsites continue without auth-refresh side effects (the next
        // Route Handler or middleware-equivalent will refresh on its own).
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* Server Component context — cookie mutation not allowed here */
        }
      },
    },
  });
}
