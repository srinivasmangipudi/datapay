import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "portal_session";
const ORG_SESSION_COOKIE = "org_session";

// A single shared ops password gates the whole portal (SPEC.md §25) — not
// per-user auth, just enough that finding the URL isn't enough to reach a
// portal that now fronts real write endpoints (snap verification, payout
// runs, fund projects, etc). /login itself, Next's own static assets, and
// public brand assets (icons, OG image — SPEC.md §28) are the only paths
// this doesn't guard; a favicon or a shared-link preview needs to load
// whether or not the viewer is signed in. /registry (SPEC.md §29) is
// deliberately public too — it's the demand registry + opportunities page,
// meant for anyone to see, not an ops tool. /privacy and /delete-account
// are public for the same reason every app store requires them to be:
// reachable without signing in to anything, including this portal.
export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;

  // A separate, independent gate for company accounts (SPEC.md addendum:
  // organizations onboarding questions) — its own cookie, its own login
  // page, never the ops shared password. "/organizations" (no trailing
  // slash) is the ops-only page for creating those accounts and must NOT
  // match here.
  if (pathname === "/org" || pathname.startsWith("/org/")) {
    if (pathname === "/org/login") return NextResponse.next();
    const orgCookie = request.cookies.get(ORG_SESSION_COOKIE)?.value;
    if (orgCookie) return NextResponse.next();
    const orgLoginUrl = new URL("/org/login", request.url);
    orgLoginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(orgLoginUrl);
  }

  const sessionSecret = process.env.PORTAL_SESSION_SECRET;
  if (!sessionSecret) {
    // Fails open only in the sense of not crashing the whole app — but every
    // page under this middleware still requires a matching cookie value, and
    // an empty required secret can never match a real cookie, so this is
    // still a hard block, just with a clearer cause than a random 500 would be.
    return new NextResponse("Portal misconfigured: missing PORTAL_SESSION_SECRET", { status: 500 });
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie === sessionSecret) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|registry|privacy|delete-account|_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png|og-image\\.png|mark-primary\\.svg|logo-tagline-asset\\.svg|site\\.webmanifest).*)",
  ],
};
