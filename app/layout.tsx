import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Display face for the wordmark and dashboard H1 only (see globals.css @theme).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

// Mono face for counts, dates, and metrics.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TeamFrame",
  description:
    "A lightweight HR structure system for startups with 6–25 employees. Installed in 48–72 hours.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
