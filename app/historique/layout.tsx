import type { Metadata } from "next";

// The page itself is a client component, so the route title lives here.
export const metadata: Metadata = {
  title: "Historique des ventes",
  description:
    "22 000+ enchères immobilières passées : adjudications, décotes vs marché DVF, surenchères — pour calibrer vos mises.",
};

export default function HistoriqueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
