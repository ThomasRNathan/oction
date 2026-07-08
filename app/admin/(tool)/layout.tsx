import { Nav } from "@/components/nav";
import { requireAuth } from "@/lib/auth/dal";

/**
 * Secure gate for the whole auction tool. Runs on every fresh load of any
 * /admin/(tool) route; `requireAuth()` redirects unauthenticated requests to
 * /admin/login (proxy.ts also pre-filters them). The data this tool shows
 * comes from /api/* route handlers, which independently verify the session.
 */
export default async function ToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
