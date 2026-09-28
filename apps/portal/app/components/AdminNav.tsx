"use client";

import { usePathname } from "next/navigation";
import { DataPayMark, DataPayWordmark } from "./DataPayLogo";
import { isPublicPath } from "../lib/public-paths";
import { logoutAction } from "../login/actions";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/onboard", label: "Onboard a question" },
  { href: "/questions", label: "Questions" },
  { href: "/topics", label: "Topics" },
  { href: "/review", label: "Review queue" },
  { href: "/product-review", label: "Product review" },
  { href: "/intelligence", label: "Area intelligence" },
  { href: "/snaps", label: "Snap verification" },
  { href: "/token-economy", label: "Token economy" },
  { href: "/fund", label: "Fund & governance" },
  { href: "/produce", label: "Produce & payouts" },
  { href: "/audit", label: "Audit & fraud" },
  { href: "/zones", label: "Zones & categories" },
  { href: "/organizations", label: "Organizations" },
];

export function AdminNav({ isOpsSession }: { isOpsSession: boolean }): JSX.Element | null {
  const pathname = usePathname();
  // "/org/..." is the separate company-login area (own nav below) — careful
  // not to match "/organizations", the ops-only page for creating those accounts.
  // Root is the one path that's session-conditional content, not a fixed
  // page — show the nav there only when it's actually the ops dashboard
  // underneath, never over the public marketing homepage.
  // Shared with middleware.ts via app/lib/public-paths.ts — these were two
  // separate hardcoded lists and drifted, which is how a public page ended up
  // rendering the ops nav above it.
  if (isPublicPath(pathname) || (pathname === "/" && !isOpsSession)) return null;

  return (
    <nav className="adminNav">
      <span className="adminNavBrand">
        {/* DataPayMark colors its ring via SVG stroke attributes driven by its
            own `dark` prop, which a stylesheet can't override after the fact —
            so the ink half of the ring vanished against the dark-mode page
            background. Render both variants and let CSS pick, same fix the
            marketing pages use. */}
        <span className="brandMarkLight">
          <DataPayMark size={20} />
        </span>
        <span className="brandMarkDark">
          <DataPayMark size={20} dark />
        </span>
        <DataPayWordmark />
        <span className="brandSuffix">Ops</span>
      </span>
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={`adminNavLink ${pathname === link.href ? "adminNavLinkOn" : ""}`}
        >
          {link.label}
        </a>
      ))}
      <span className="adminNavSpacer" />
      <form action={logoutAction}>
        <button type="submit" className="adminNavLogout">
          Log out
        </button>
      </form>
    </nav>
  );
}
