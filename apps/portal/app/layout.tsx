export const metadata = {
  title: "DataPay Portal",
  description: "Supplier + ops back office — aggregates only, never member rows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <style>{`
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
        `}</style>
      </body>
    </html>
  );
}
