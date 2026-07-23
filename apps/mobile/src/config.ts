// Mobile talks only to Core API, never Vault directly (SPEC.md §9) — Vault isn't
// internet-facing. EXPO_PUBLIC_ prefix makes this available to the client bundle.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
