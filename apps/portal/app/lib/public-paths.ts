/**
 * Paths reachable without an ops session.
 *
 * This list is consumed twice: middleware.ts decides whether to redirect to
 * /login, and AdminNav decides whether to render the ops chrome. Those two
 * lived as separate hardcoded lists and drifted — /brand was added to the
 * middleware and not to AdminNav, so a public brand page rendered with
 * "Dashboard / Review queue / Audit & fraud" sitting above it.
 *
 * Next requires config.matcher to be statically analysable, so the middleware
 * regex is still written out literally. public-paths.spec.ts asserts the two
 * agree, which is what actually stops them drifting again.
 */
export const PUBLIC_EXACT_PATHS = [
  "/login",
  "/registry",
  "/privacy",
  "/delete-account",
  "/child-safety",
  "/about",
  "/brand",
  // The delivery person's surface. They are not ops and must never hit the
  // ops login — their own token gates the data, server-side.
  "/delivery",
] as const;

/** Public path prefixes — every route beneath them is public too. */
export const PUBLIC_PATH_PREFIXES = ["/org/", "/store/"] as const;

export function isPublicPath(pathname: string): boolean {
  return (
    (PUBLIC_EXACT_PATHS as readonly string[]).includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
