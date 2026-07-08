import type { Metadata } from "next";

// The page itself is a client component, so the route title lives here.
export const metadata: Metadata = {
  title: "Calculateur d'adjudication",
  description:
    "Estimez le coût total d'une vente aux enchères judiciaire : émoluments d'avocat, droits d'enregistrement (DMTO), contribution de sécurité immobilière, frais préalables, caution et seuil de surenchère.",
};

export default function CalculateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
