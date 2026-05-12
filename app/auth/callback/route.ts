import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/auth/server";

/**
 * Auth callback — handles both flows:
 *
 *   1. OAuth (Google): Supabase redirects here with `?code=...`. We exchange
 *      the code for a session, which sets the auth cookie via our server
 *      client's `cookies.setAll` adapter.
 *   2. Magic link (email): same `?code=...` flow — `exchangeCodeForSession`
 *      works for both. The link in the email points at this route, and on
 *      success we redirect back to wherever the user came from.
 *
 * The `next` query param carries the post-auth landing path (defaults to
 * "/"). It's a same-origin path so we don't accept absolute URLs that could
 * be used for open-redirect abuse.
 *
 * On failure we send the user to /?auth_error=<code>; the AuthGate reads that
 * param and surfaces a friendly message instead of failing silently.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  // Same-origin only: drop anything starting with // or with a scheme.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
