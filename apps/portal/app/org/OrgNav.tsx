"use client";

import { usePathname } from "next/navigation";
import { DataPayMark } from "../components/DataPayLogo";
import { orgLogoutAction } from "./login/actions";

export function OrgNav({ orgName }: { orgName: string | null }): JSX.Element | null {
  const pathname = usePathname();
  if (pathname === "/org/login") return null;

  return (
    <nav className="adminNav">
      <span className="adminNavBrand">
        <DataPayMark size={20} />
        {orgName ?? "DataPay"} — Organization
      </span>
      <a href="/org/questions" className={`adminNavLink ${pathname === "/org/questions" ? "adminNavLinkOn" : ""}`}>
        Submit a question
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
