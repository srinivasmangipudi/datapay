export const metadata = {
  title: "DataPay Portal",
  description: "Supplier + ops back office — aggregates only, never member rows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        {children}
        {/* dangerouslySetInnerHTML, not <style>{`...`}</style> — a `"` inside a plain
            JSX-child string on a <style> tag hits a known React SSR/CSR escaping
            mismatch (server HTML-entity-encodes it, client doesn't), causing a
            hydration error the moment any rule here needs a quoted value. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          :root { color-scheme: light; --page-bg: #f9f9f7; --ink: #0b0b0b; }
          @media (prefers-color-scheme: dark) {
            :root:not([data-theme="light"]) { color-scheme: dark; --page-bg: #0d0d0d; --ink: #ffffff; }
          }
          :root[data-theme="dark"] { color-scheme: dark; --page-bg: #0d0d0d; --ink: #ffffff; }
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
