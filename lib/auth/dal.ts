/**
 * Data Access Layer for auth — the *secure* server-side gate.
 *
 * proxy.ts does a cheap optimistic redirect (cookie presence). The real check
 * lives here and runs in the admin layout + every protected route handler, so
 * a forged/stale cookie that slips past the proxy still gets nothing.
 *
 * This module must only be imported from server components / route handlers
 * (it reads the request session via Auth.js `auth()`).
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/** Memoized per render pass so multiple callers share one resolution. */
export const getSession = cache(async (): Promise<Session | null> => auth());

/**
 * Admin server components / layouts: returns the session or redirects to the
 * login page. Use at the top of any protected server component.
 */
export async function requireAuth(callbackUrl?: string): Promise<Session> {
  const session = await getSession();
  if (!session?.user) {
    redirect(
      callbackUrl
        ? `/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : "/admin/login"
    );
  }
  return session;
}

/**
 * Route handlers: returns the session, or null when unauthenticated so the
 * caller can respond 401 (handlers must not redirect).
 */
export async function getApiSession(): Promise<Session | null> {
  return getSession();
}

/**
 * Guard for protected route handlers. Returns a 401 `Response` to return early
 * when unauthenticated, or `null` when the request may proceed:
 *
 *   const guard = await requireApiAuth();
 *   if (guard) return guard;
 */
export async function requireApiAuth(): Promise<Response | null> {
  const session = await getSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
