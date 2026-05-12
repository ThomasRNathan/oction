/**
 * Browser-side Supabase client with cookie-backed session.
 *
 * Use only from "use client" components. Reuses the same NEXT_PUBLIC_* env
 * vars as lib/supabase.ts; the difference is `createBrowserClient` reads and
 * writes the auth cookie that the server-side helper expects to find.
 *
 * One instance per browser page-load is fine (cheap), but we memoize so
 * concurrent components see the same auth state cache.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  _client = createBrowserClient(url, key);
  return _client;
}
