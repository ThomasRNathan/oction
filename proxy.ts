import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth gate (Next.js 16 renamed Middleware → Proxy).
 *
 * Per the Next.js auth guidance, Proxy should only do a *cheap* optimistic
 * check — here, "is an Auth.js session cookie present?" — and redirect early.
 * The authoritative verification happens server-side in lib/auth/dal.ts
 * (admin layout + protected route handlers), so a forged cookie that passes
 * this presence check still gets nothing downstream.
 *
 * Only `/admin/**` is guarded; the public marketing site and SEO pages are open.
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page must stay reachable to unauthenticated users.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));
  if (!hasSession) {
    const url = new URL("/admin/login", request.nextUrl);
    url.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Run only on the admin tool. The Auth.js API routes (/api/auth/*) are excluded
// so the sign-in/callback flow itself is never gated.
export const config = {
  matcher: ["/admin/:path*"],
};
