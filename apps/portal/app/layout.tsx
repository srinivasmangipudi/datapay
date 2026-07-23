export const metadata = {
  title: "DataPay Portal",
  description: "Supplier + ops back office — aggregates only, never member rows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
