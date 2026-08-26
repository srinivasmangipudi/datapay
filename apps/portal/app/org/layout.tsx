import { cookies } from "next/headers";
import { OrgNav } from "./OrgNav";

export default function OrgLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const orgName = cookies().get("org_name")?.value ?? null;
  return (
    <>
      <OrgNav orgName={orgName} />
      {children}
    </>
  );
}
