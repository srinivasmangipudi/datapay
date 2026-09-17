"use client";

import { usePathname } from "next/navigation";
import { DataPayMark } from "../components/DataPayLogo";
import { orgLogoutAction } from "./login/actions";

export function OrgNav({ orgName }: { orgName: string | null }): JSX.Element | null {
  const pathname = usePathname();
  // /org/signup is public too, same reason as /org/login — a visitor there
  // has no session to log out of, and the nav's own links (Submit a
  // question, Products) require one anyway.
  if (pathname === "/org/login" || pathname === "/org/signup") return null;

  return (
    <nav className="adminNav">
      <span className="adminNavBrand">
        <DataPayMark size={20} />
        {orgName ?? "DataPay"} — Organization
      </span>
      <a href="/org/questions" className={`adminNavLink ${pathname === "/org/questions" ? "adminNavLinkOn" : ""}`}>
        Submit a question
      </a>
      <a href="/org/products" className={`adminNavLink ${pathname === "/org/products" ? "adminNavLinkOn" : ""}`}>
        Products
      </a>
      <span className="adminNavSpacer" />
      <form action={orgLogoutAction}>
        <button type="submit" className="adminNavLogout">
          Log out
        </button>
      </form>
    </nav>
  );
}
