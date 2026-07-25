// §10 boundary, unchanged: `categories` is one of this role's original four
// grants (direct Postgres read, same as the home page). Creating a question
// and listing recently-authored ones goes through Core API instead
// (core-api.ts) — no new grant for this page either.
import { getPortalPool } from "../db";
import { listRecentAdminQuestions } from "./core-api";
import { QuestionWizard } from "./QuestionWizard";

export const dynamic = "force-dynamic";

interface Category {
  id: number;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  level: string;
  languageCode: string | null;
}

async function getCategories(): Promise<Category[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Category>(`SELECT id, name FROM categories ORDER BY name`);
  return rows;
}

async function getZones(): Promise<Zone[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Zone>(
    `SELECT id, name, level, language_code AS "languageCode" FROM zones ORDER BY level, name`
  );
  return rows;
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string };
}): Promise<JSX.Element> {
  const [categories, zones, recentQuestions] = await Promise.all([
    getCategories(),
    getZones(),
    listRecentAdminQuestions(),
  ]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>New question</h1>
      <p className="lede">
        Pick a category, write the question, choose how members answer it. No draft queue here —
        an admin authoring a question directly is itself the review (SPEC.md §14/§21); it's
        selectable in Pulse the moment you submit.
      </p>
      {searchParams.error && (
        <div className="errorBanner">
          <strong>Couldn't create question:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.created && <div className="successBanner">Question created.</div>}

      <QuestionWizard categories={categories} zones={zones} />

      <section className="section">
        <h2>Recently created ({recentQuestions.length})</h2>
        {recentQuestions.length === 0 && <p className="empty">Nothing created here yet.</p>}
        {recentQuestions.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>Evidence</th>
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                {recentQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      {q.text_en}
                      {q.translations &&
                        Object.entries(q.translations).map(([lang, text]) => (
                          <div key={lang} className="muted small">
                            {text}
                          </div>
                        ))}
                    </td>
                    <td className="mono small">{q.type}</td>
                    <td className="small">{q.zone_name ?? <span className="muted">Global</span>}</td>
                    <td className="small muted">
                      {[q.allow_photo && "photo", q.allow_voice && "voice"].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="num value">{q.reward_tokens} ◈</td>
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
