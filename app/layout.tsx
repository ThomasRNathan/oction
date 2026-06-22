import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "OCTION — Analyseur d'enchères immobilières",
    template: "%s · OCTION",
  },
  description:
    "Analysez les ventes aux enchères judiciaires : prix du marché DVF, décote, score d'attractivité, simulateur de financement — et le radar des meilleures opportunités à venir.",
  applicationName: "OCTION",
  openGraph: {
    title: "OCTION — Analyseur d'enchères immobilières",
    description:
      "Achetez l'immobilier à −30/40 % du marché : analyse DVF instantanée et radar des ventes judiciaires à venir.",
    locale: "fr_FR",
    type: "website",
    siteName: "OCTION",
  },
  twitter: {
    card: "summary",
    title: "OCTION — Analyseur d'enchères immobilières",
    description:
      "Analyse DVF instantanée et radar des ventes judiciaires à venir.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
};

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
      <body className="min-h-full bg-[#0a0f1a]">
        <Nav />
        {children}
      </body>
    </html>
  );
}
