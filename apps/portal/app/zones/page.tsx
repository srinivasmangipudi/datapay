import { getPortalPool } from "../db";
import { MergeCategories } from "./MergeCategories";
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
      <header className="pageHead">
        <p className="eyebrow">DataPay Portal · Ops</p>
        <h1>Zones &amp; categories</h1>
        <p className="lede">
          Zones are the region hierarchy that questions and funds are scoped to — a village sits
          inside a panchayat, inside a hobli, inside a constituency. Categories are how demand and
          Pulse questions are grouped. A zone's centroid is just a representative point (say, the
          town center) used to match a member's phone location to the nearest zone — not a real
          boundary.
        </p>
      </header>

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
        <MergeCategories categories={categories} />
      </section>
    </main>
  );
}
