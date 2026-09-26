import { getPortalPool } from "../db";
import { listFundProjects } from "./core-api";
import { FundProjectsTable } from "./FundProjectsTable";
import { FundWizard } from "./FundWizard";

export const dynamic = "force-dynamic";

interface Zone {
  id: string;
  name: string;
  level: string;
}

async function getZones(): Promise<Zone[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Zone>(`SELECT id, name, level FROM zones ORDER BY level, name`);
  return rows;
}

export default async function FundPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string; updated?: string };
}): Promise<JSX.Element> {
  const [zones, projects] = await Promise.all([getZones(), listFundProjects()]);

  return (
    <main className="page">
      <header className="pageHead">
        <p className="eyebrow">DataPay Portal · Ops</p>
        <h1>Fund &amp; governance</h1>
        <p className="lede">
          When a collective buy is delivered, 20% of the savings it created goes back to that zone as
          a community pool, spent only on local projects the zone votes for. No member money is
          pooled or held here. Propose a project for a zone; members in that zone vote yes/no in the
          app — this page never approves a project for them.
        </p>
      </header>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Action failed:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.created && <div className="successBanner">Project proposed.</div>}
      {searchParams.updated && <div className="successBanner">Project updated.</div>}

      <FundWizard zones={zones} />

      <section className="section">
        <h2>Projects ({projects.length})</h2>
        {projects.length === 0 && <p className="empty">No projects proposed yet.</p>}
        {projects.length > 0 && <FundProjectsTable projects={projects} />}
      </section>
    </main>
  );
}
