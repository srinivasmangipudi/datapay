import { getPortalPool } from "../db";
import { CategoryWizard } from "./CategoryWizard";
import { ZoneWizard } from "./ZoneWizard";
import { ZonesTable, type ZoneRow } from "./ZonesTable";

export const dynamic = "force-dynamic";

interface Category {
  id: number;
  slug: string;
  name: string;
  name_kn: string | null;
  sensitivity: string;
}

async function getZones(): Promise<ZoneRow[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<ZoneRow>(
    `SELECT id, parent_id, name, name_kn, level, centroid_lat, centroid_lng, language_code
     FROM zones ORDER BY level, name`
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
  searchParams: { error?: string; created?: string; updated?: string };
}): Promise<JSX.Element> {
  const [zones, categories] = await Promise.all([getZones(), getCategories()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Zones &amp; categories</h1>
      <p className="lede">
        Zones form the region hierarchy questions and funds are scoped to (village ⊂ panchayat ⊂
        hobli ⊂ constituency). Categories are what demand aggregation and Pulse questions are grouped
        by. A zone's centroid (below) is a representative point — used only to match a member's
        phone GPS to the nearest zone when they answer a question (SPEC.md §35), not a real boundary.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Couldn't create:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.created === "zone" && <div className="successBanner">Zone created.</div>}
      {searchParams.created === "category" && <div className="successBanner">Category created.</div>}
      {searchParams.updated === "zone" && <div className="successBanner">Zone centroid updated.</div>}

      <section className="section">
        <h2>Zones ({zones.length})</h2>
        <ZonesTable zones={zones} />
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
