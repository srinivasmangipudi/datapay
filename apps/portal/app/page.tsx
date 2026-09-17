import { cookies } from "next/headers";
import { getLang } from "./lib/language";
import { MarketingHome } from "./MarketingHome";
import { OpsDashboard } from "./OpsDashboard";

export const dynamic = "force-dynamic";

// Root is session-conditional (middleware.ts exempts "/" from the ops-login
// redirect specifically so this can decide for itself): a valid ops session
// sees the existing dashboard at the same URL every AdminNav link already
// points to; anyone else sees the public marketing homepage.
export default async function RootPage(): Promise<JSX.Element> {
  const sessionSecret = process.env.PORTAL_SESSION_SECRET;
  const cookie = cookies().get("portal_session")?.value;
  const isOpsSession = Boolean(sessionSecret) && cookie === sessionSecret;

  return isOpsSession ? <OpsDashboard /> : <MarketingHome lang={getLang()} />;
}
