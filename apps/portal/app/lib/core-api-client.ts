// Shared by every portal feature that talks to Core API (intelligence,
// questions, ...) rather than querying Postgres directly — §10's boundary:
// the portal's restricted DB role only ever reads demand_aggregates/
// token_rate/zones/categories, so anything else (reads AND writes) goes
// through here instead of a new grant.
function apiBaseUrl(): string {
  const url = process.env.CORE_API_INTERNAL_URL;
  if (!url) throw new Error("Missing CORE_API_INTERNAL_URL");
  return url;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // NestJS's HttpException body is {message, error, statusCode} — surface
    // just the message (what's actually useful, e.g. "Missing
    // GOOGLE_SERVICE_ACCOUNT_KEY...") to the caller, not the whole wrapper.
    // The full response still goes to the server log, for anyone who needs
    // the status code/path too.
    const rawMessage =
      data && typeof data === "object" && "message" in data
        ? (data as { message: unknown }).message
        : undefined;
    const message =
      typeof rawMessage === "string"
        ? rawMessage
        : rawMessage !== undefined
          ? JSON.stringify(rawMessage) // e.g. a zod .flatten() validation error, not a plain string
          : `Core API ${init?.method ?? "GET"} ${path} → ${res.status}`;
    console.error(`Core API ${init?.method ?? "GET"} ${path} → ${res.status}:`, data);
    throw new Error(message);
  }
  return data;
}
