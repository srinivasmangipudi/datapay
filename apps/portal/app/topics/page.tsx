import { getPortalPool } from "../db";
import { generateNowAction } from "./actions";
import { listTopics } from "./core-api";
import { TopicWizard } from "./TopicWizard";

export const dynamic = "force-dynamic";

interface Category {
  id: number;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  level: string;
}

async function getCategories(): Promise<Category[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Category>(`SELECT id, name FROM categories ORDER BY name`);
  return rows;
}

async function getZones(): Promise<Zone[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Zone>(`SELECT id, name, level FROM zones ORDER BY level, name`);
  return rows;
}

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string; generated?: string };
}): Promise<JSX.Element> {
  const [categories, zones, topics] = await Promise.all([getCategories(), getZones(), listTopics()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Question topics</h1>
      <p className="lede">
        A topic is a standing question-generator: template (you write the variant) or
        document-grounded (an LLM drafts from a zone's ingested intelligence). Give it a schedule and
        it runs unattended (SPEC.md §24) — leave it blank and trigger it yourself with "Generate now."
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Action failed:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.created && <div className="successBanner">Topic created.</div>}
      {searchParams.generated && <div className="successBanner">Generation run triggered.</div>}

      <TopicWizard categories={categories} zones={zones} />

      <section className="section">
        <h2>Topics ({topics.length})</h2>
        {topics.length === 0 && <p className="empty">No topics yet.</p>}
        {topics.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Generator</th>
                  <th>Category</th>
                  <th>Region</th>
                  <th>Schedule</th>
                  <th>Last run</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.name}
                      <div className="muted small mono">{t.slug}</div>
                    </td>
                    <td className="small">{t.generator_kind}</td>
                    <td className="small">{t.category_name}</td>
                    <td className="small">{t.zone_name ?? <span className="muted">Global</span>}</td>
                    <td className="mono small">{t.schedule_cron ?? <span className="muted">Manual only</span>}</td>
                    <td className="small">
                      {t.last_run_status ? (
                        <>
                          {t.last_run_status}
                          <div className="muted small">
                            {t.last_run_at ? new Date(t.last_run_at).toLocaleString() : ""}
                          </div>
                        </>
                      ) : (
                        <span className="muted">Never run</span>
                      )}
                    </td>
                    <td>
                      <form action={generateNowAction}>
                        <input type="hidden" name="topicId" value={t.id} />
                        <button type="submit" className="linkBtn">
                          Generate now
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
