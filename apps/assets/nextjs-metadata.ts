// ─────────────────────────────────────────────────────────────
// DataPay · Next.js metadata (App Router)
// Drop this `metadata` export into your root app/layout.tsx.
// Copy everything in /nextjs-public into your project's /public folder.
// Also copy og-image.png + og-image-work.png (from datapay-assets/) into /public.
// ─────────────────────────────────────────────────────────────
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "DataPay — Your data is your asset",
    template: "%s · DataPay",
  },
  description:
    "DataPay collectivises household demand — anonymously — so people get better prices, communities get a fund, and producers reach the market directly.",
  applicationName: "DataPay",
  manifest: "/site.webmanifest",
  themeColor: "#101418",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "DataPay — Your data is your asset",
    description:
      "Collective demand, direct to you. A social enterprise for data sovereignty.",
    siteName: "DataPay",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DataPay — Your data is your asset",
    description: "Collective demand, direct to you.",
    images: ["/og-image.png"],
  },
};

// If you use the App Router file convention instead of this export,
// you can alternatively just place favicon.ico, icon.svg and
// apple-touch-icon.png directly in /app and Next will wire them up.
