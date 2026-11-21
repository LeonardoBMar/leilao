import "./globals.css";

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "./providers";

/** Direção v3.0 "Cirúrgico & Monocromático" (DESIGN.md §3.2): Inter na interface, JetBrains Mono em códigos e atalhos. */
const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
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
