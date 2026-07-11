import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Cormorant } from "next/font/google";
import "./globals.css";
import { AppShell } from "./_components/app-shell";

// UI / body / headings — a neutral grotesque standing in for Panagram.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Data, numerals, ids, scores, agent output — monospace so numbers align.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

// The brand serif (standing in for Panagram Signature): italic for the wordmark
// and the Overview hero, upright for page titles across the console.
const cormorant = Cormorant({
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "warrant — operator console",
  description:
    "An operating system for a mixed workforce of humans and AI agents. Watch the router reason, supply judgment, approve at the gate, and read reliability as it accumulates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${plexMono.variable} ${cormorant.variable} antialiased`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
