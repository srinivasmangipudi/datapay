// Proxies the CSV download through the portal's own origin rather than
// exposing CORE_API_INTERNAL_URL to the browser directly — same boundary
// every other portal page respects (browser only ever talks to this app).
import { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<Response> {
  const apiUrl = process.env.CORE_API_INTERNAL_URL;
  if (!apiUrl) return new Response("Missing CORE_API_INTERNAL_URL", { status: 500 });

  const since = request.nextUrl.searchParams.get("since");
  const url = `${apiUrl}/v1/admin/audit-export${since ? `?since=${encodeURIComponent(since)}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  const csv = await res.text();

  return new Response(csv, {
    status: res.status,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="datapay-ledger-export.csv"`,
    },
  });
}
