// §10 boundary, unchanged: zones/categories are two of this role's original
// four direct-read grants (same as zones/page.tsx and questions/page.tsx).
// Every write in this wizard goes through Core API (core-api.ts).
import { getPortalPool } from "../db";
import { OnboardWizard } from "./OnboardWizard";
import type { Zone } from "./PlaceStep";
import type { Category } from "./StrategyStep";

export const dynamic = "force-dynamic";

async function getZones(): Promise<Zone[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Zone>(
    `SELECT id, parent_id AS "parentId", name, name_kn AS "nameKn", level FROM zones ORDER BY level, name`
  );
  return rows;
}

async function getCategories(): Promise<Category[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Category>(`SELECT id, name FROM categories ORDER BY name`);
  return rows;
}

export default async function OnboardPage(): Promise<JSX.Element> {
  const [zones, categories] = await Promise.all([getZones(), getCategories()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Onboard a question</h1>
      <p className="lede">
        Place → area intelligence → how it gets written → the question itself → review — one flow,
        in order. Every existing page (Zones, Intelligence, Topics, Questions, Review queue) is
        still there if you want to work outside this flow.
      </p>

      <OnboardWizard zones={zones} categories={categories} />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .onboardProgress { display: flex; gap: 4px; margin-bottom: 24px; flex-wrap: wrap; }
        .onboardProgressStep { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #898781; padding: 4px 10px; border-radius: 999px; background: #f3f2ee; }
        .onboardProgressStepDone { background: #e3f0e9; color: #0E7A5C; }
        .onboardProgressStepOn { background: #0E7A5C; color: #fff; }
        .placeList { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
        .placeRow { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 6px; border: 1px solid #e1e0d9; background: #fcfcfb; cursor: pointer; font-size: 13.5px; text-align: left; }
        .placeRow:hover { border-color: #0E7A5C; }
        .placeActions { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
        .breadcrumb { font-size: 12.5px; color: #0E7A5C; font-weight: 700; }
        .understanding { border: 1px solid #e1e0d9; border-radius: 6px; padding: 16px; margin-bottom: 12px; }
        .summary { font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
        @media (prefers-color-scheme: dark) {
          .onboardProgressStep { background: #1a1a19; color: #9b9a94; }
          .onboardProgressStepDone { background: #133d2c; color: #4fc493; }
          .placeRow { background: #14161b; border-color: #2c2c2a; }
          .understanding { border-color: #2c2c2a; }
        }
      `,
        }}
      />
    </main>
  );
}
