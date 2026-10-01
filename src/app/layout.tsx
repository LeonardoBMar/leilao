import "./globals.css";

import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

import { Providers } from "./providers";

/** Direção A (DESIGN.md §4): Hanken Grotesk na interface, IBM Plex Mono em códigos (lote, leilão, ids). */
const sans = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Leilão Tracker",
  description: "Acompanhe lotes e preserve suas análises de leilões.",
  // Aplicativo privado (ver também src/app/robots.ts).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${mono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
