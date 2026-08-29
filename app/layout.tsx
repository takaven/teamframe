import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted so a production build never depends on fonts.googleapis.com being reachable.
// Faces are the same families previously loaded via next/font/google; the woff2 files live in
// app/fonts/ and are fingerprinted and served by Next, so builds are deterministic and offline.
const mulish = localFont({
  src: "./fonts/mulish-variable-latin.woff2",
  weight: "400 800",
  style: "normal",
  variable: "--font-mulish",
  display: "swap",
  fallback: ["Avenir Next", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

// Display face for the wordmark and dashboard H1 only (see globals.css @theme).
const fraunces = localFont({
  src: "./fonts/fraunces-variable-latin.woff2",
  weight: "500 800",
  style: "normal",
  variable: "--font-fraunces",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// Mono face for counts, dates, and metrics.
const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500-latin.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "TeamFrame",
    template: "%s · TeamFrame",
  },
  description: "A focused HR system for organisations without a dedicated HR team — employee records, documents, leave, onboarding and policies in one place.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mulish.variable} ${fraunces.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
