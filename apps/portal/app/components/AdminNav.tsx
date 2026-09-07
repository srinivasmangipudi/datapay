"use client";

import { usePathname } from "next/navigation";
import { DataPayMark } from "./DataPayLogo";
import { logoutAction } from "../login/actions";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/onboard", label: "Onboard a question" },
  { href: "/questions", label: "Questions" },
  { href: "/topics", label: "Topics" },
  { href: "/review", label: "Review queue" },
  { href: "/intelligence", label: "Area intelligence" },
  { href: "/snaps", label: "Snap verification" },
  { href: "/token-economy", label: "Token economy" },
  { href: "/fund", label: "Fund & governance" },
  { href: "/produce", label: "Produce & payouts" },
  { href: "/audit", label: "Audit & fraud" },
  { href: "/zones", label: "Zones & categories" },
  { href: "/organizations", label: "Organizations" },
];

export function AdminNav(): JSX.Element | null {
  const pathname = usePathname();
  // "/org/..." is the separate company-login area (own nav below) — careful
  // not to match "/organizations", the ops-only page for creating those accounts.
  if (
    pathname === "/login" ||
    pathname === "/registry" ||
    pathname === "/privacy" ||
    pathname === "/delete-account" ||
    pathname.startsWith("/org/")
  )
    return null;

  return (
    <nav className="adminNav">
      <span className="adminNavBrand">
        <DataPayMark size={20} />
        DataPay Ops
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
