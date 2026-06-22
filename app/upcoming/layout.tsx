import type { Metadata } from "next";

// The page itself is a client component, so the route title lives here.
export const metadata: Metadata = {
  title: "Ventes à venir",
  description:
    "Toutes les enchères immobilières judiciaires programmées — filtrez par budget, tribunal, type et décote vs DVF.",
};

export default function UpcomingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
