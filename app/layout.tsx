import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Sora } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

// okara.ai self-hosts these three through next/font: Sora for headings, DM Sans for UI, JetBrains Mono for code.
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "500", "600"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "The First 60 Seconds: an Okara onboarding concept", template: "%s · The First 60 Seconds" },
  description:
    "An unofficial Okara concept by Hafsa Usmani: paste any URL and get real SEO and AI-readiness findings and a ready-to-ship fix in seconds, before sign-up.",
  metadataBase: new URL("https://first60-concept.vercel.app"),
  // A concept for one reader: keep it out of search so it never competes with okara.ai.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#110f0e", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable} ${mono.variable} antialiased`}>
      <body className="font-sans">
        <Shell>{children}</Shell>
        <Analytics />
      </body>
    </html>
  );
}
