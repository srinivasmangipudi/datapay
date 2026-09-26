import type { Viewport } from "next";
import { cookies } from "next/headers";
import { AdminNav } from "./components/AdminNav";
import "./globals.css";

// Icons (favicon.ico, icon.png, apple-icon.png) are wired automatically by
// Next's App Router file convention — no icons block needed here. Source:
// apps/assets (the DataPay brand package) — see apps/assets/README.md.
//
// metadataBase is what Next resolves the OG image's relative path against.
// This app serves the public marketing site as well as the internal portal,
// so a shared link does get previewed — without this, Next falls back to
// localhost and the card renders with a broken image.
export const metadata = {
  metadataBase: new URL("https://datapay.in"),
  title: {
    default: "DataPay Portal",
    template: "%s · DataPay Portal",
  },
  description: "Supplier + ops back office — aggregates only, never member rows.",
  applicationName: "DataPay Portal",
  openGraph: {
    title: "DataPay Portal",
    description: "Supplier + ops back office — aggregates only, never member rows.",
    siteName: "DataPay",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#101418",
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const sessionSecret = process.env.PORTAL_SESSION_SECRET;
  const cookie = cookies().get("portal_session")?.value;
  const isOpsSession = Boolean(sessionSecret) && cookie === sessionSecret;

  return (
    <html lang="en">
      <body>
        <AdminNav isOpsSession={isOpsSession} />
        {children}
        {/* dangerouslySetInnerHTML, not <style>{`...`}</style> — a `"` inside a plain
            JSX-child string on a <style> tag hits a known React SSR/CSR escaping
            mismatch (server HTML-entity-encodes it, client doesn't), causing a
            hydration error the moment any rule here needs a quoted value. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          :root { color-scheme: light; --page-bg: #F6F5F1; --ink: #101418; }
          @media (prefers-color-scheme: dark) {
            :root:not([data-theme="light"]) { color-scheme: dark; --page-bg: #101418; --ink: #F6F5F1; }
          }
          :root[data-theme="dark"] { color-scheme: dark; --page-bg: #101418; --ink: #F6F5F1; }
          body {
            margin: 0;
            background: var(--page-bg);
            color: var(--ink);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          }
        `,
          }}
        />
      </body>
    </html>
  );
}
