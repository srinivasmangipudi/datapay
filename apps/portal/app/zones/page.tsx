import { getPortalPool } from "../db";
import { CategoryWizard } from "./CategoryWizard";
import { ZoneWizard } from "./ZoneWizard";

export const dynamic = "force-dynamic";

interface Zone {
  id: string;
  parent_id: string | null;
  name: string;
  name_kn: string | null;
  level: string;
}

interface Category {
  id: number;
  slug: string;
  name: string;
  name_kn: string | null;
  sensitivity: string;
}

const LEVEL_INDENT: Record<string, string> = {
  constituency: "",
  hobli: "— ",
  panchayat: "—— ",
  village: "——— ",
};

async function getZones(): Promise<Zone[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Zone>(
    `SELECT id, parent_id, name, name_kn, level FROM zones ORDER BY level, name`
  );
  return rows;
}

async function getCategories(): Promise<Category[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Category>(
    `SELECT id, slug, name, name_kn, sensitivity FROM categories ORDER BY name`
  );
  return rows;
}

export default async function ZonesPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string };
}): Promise<JSX.Element> {
  const [zones, categories] = await Promise.all([getZones(), getCategories()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Zones &amp; categories</h1>
      <p className="lede">
        Zones form the region hierarchy questions and funds are scoped to (village ⊂ panchayat ⊂
        hobli ⊂ constituency). Categories are what demand aggregation and Pulse questions are grouped
        by.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Couldn't create:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.created === "zone" && <div className="successBanner">Zone created.</div>}
      {searchParams.created === "category" && <div className="successBanner">Category created.</div>}

      <section className="section">
        <h2>Zones ({zones.length})</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td>
                    {LEVEL_INDENT[z.level] ?? ""}
                    {z.name}
                    {z.name_kn && <span className="muted small"> · {z.name_kn}</span>}
                  </td>
                  <td className="level">{z.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ZoneWizard zones={zones} />
      </section>

      <section className="section">
        <h2>Categories ({categories.length})</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Sensitivity</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.name_kn && <span className="muted small"> · {c.name_kn}</span>}
                  </td>
                  <td className="mono small">{c.slug}</td>
                  <td className="small">{c.sensitivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CategoryWizard />
      </section>
    </main>
  );
}
