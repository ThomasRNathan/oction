import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://oction.fr"),
  title: {
    default: "OCTION — Sourcing algorithmique d'enchères immobilières judiciaires",
    template: "%s · OCTION",
  },
  description:
    "Opérateur spécialisé dans le sourcing algorithmique des ventes aux enchères immobilières judiciaires en France. Méthode propriétaire de détection et de sélection des lots.",
  applicationName: "OCTION",
  openGraph: {
    title: "OCTION — Sourcing d'enchères immobilières judiciaires",
    description:
      "Méthode propriétaire de sourcing algorithmique des ventes judiciaires immobilières en France.",
    locale: "fr_FR",
    type: "website",
    siteName: "OCTION",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
};

// Root layout is intentionally minimal: the marketing site (app/(marketing))
// and the admin tool (app/admin) each supply their own chrome.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0a0f1a]">{children}</body>
    </html>
  );
}
