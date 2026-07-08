import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

/**
 * Public marketing chrome (header + footer disclaimer) wrapping the landing,
 * the /encheres/[ville] SEO pages, and the investor page. A shared, fixed
 * background layer (color mesh + dot grid) gives every page the same premium
 * canvas. The (marketing) group does not affect URLs; the admin tool has its
 * own chrome.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen text-slate-200 overflow-x-hidden">
      {/* Fixed premium canvas behind all content */}
      <div className="fixed inset-0 -z-10 bg-mesh" />
      <div className="fixed inset-0 -z-10 bg-dotgrid" />

      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
