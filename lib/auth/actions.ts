"use server";

import { signIn, signOut } from "@/auth";

/**
 * Send a Resend magic link to the submitted email. Auth.js redirects to the
 * "verify request" page on success (/admin/login?sent=1) and to the error page
 * if the address isn't allowlisted. `callbackUrl` returns the operator to the
 * page they were trying to reach.
 */
export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const callbackUrl = String(formData.get("callbackUrl") ?? "/admin") || "/admin";
  await signIn("resend", { email, redirectTo: callbackUrl });
}

/** Sign the operator out and return to the login screen. */
export async function signOutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
