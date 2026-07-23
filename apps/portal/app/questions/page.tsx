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

async function getCategories(): Promise<Category[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Category>(`SELECT id, name FROM categories ORDER BY name`);
  return rows;
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string };
}): Promise<JSX.Element> {
  const [categories, recentQuestions] = await Promise.all([
    getCategories(),
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
      <p className="navLink">
        <a href="/">← Demand &amp; token rate</a> · <a href="/intelligence">Area intelligence →</a>
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Couldn't create question:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.created && <div className="successBanner">Question created.</div>}

      <QuestionWizard categories={categories} />

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
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                {recentQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      {q.text_en}
                      {q.text_kn && <div className="muted small">{q.text_kn}</div>}
                    </td>
                    <td className="mono small">{q.type}</td>
                    <td className="num">{q.reward_tokens} ◈</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .page { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
        .eyebrow { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #2a78d6; font-weight: 700; margin: 0 0 8px; }
        h1 { font-size: 1.8rem; margin: 0 0 12px; }
        .lede { color: #52514e; max-width: 68ch; margin: 0 0 12px; font-size: 14px; line-height: 1.6; }
        .navLink { margin: 0 0 28px; font-size: 13.5px; }
        .navLink a { color: #2a78d6; font-weight: 600; text-decoration: none; }
        .navLink a:hover { text-decoration: underline; }
        .errorBanner { background: #f3e4e2; border: 1px solid #8c3a34; color: #8c3a34; border-radius: 6px; padding: 12px 16px; font-size: 13px; margin-bottom: 24px; }
        .successBanner { background: #e4f2ed; border: 1px solid #0e7a5c; color: #0e7a5c; border-radius: 6px; padding: 12px 16px; font-size: 13px; margin-bottom: 24px; }
        .wizard { display: flex; flex-direction: column; gap: 28px; margin-bottom: 48px; }
        .clientError { background: #f3e4e2; border: 1px solid #8c3a34; color: #8c3a34; border-radius: 6px; padding: 10px 14px; font-size: 13px; }
        .step { display: flex; flex-direction: column; gap: 10px; }
        .stepLabel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #898781; font-weight: 700; }
        .step input, .step select { padding: 9px 12px; border-radius: 6px; border: 1px solid #d8d7cf; background: #fcfcfb; font-size: 14px; font-family: inherit; }
        .typeGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
        .typeCard { position: relative; border: 1.5px solid #d8d7cf; border-radius: 8px; padding: 12px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; background: #fcfcfb; }
        .typeCard input { position: absolute; opacity: 0; pointer-events: none; }
        .typeCardOn { border-color: #2a78d6; background: #eaf1fb; }
        .typeCardLabel { font-size: 14px; font-weight: 700; }
        .typeCardHint { font-size: 12px; color: #898781; line-height: 1.4; }
        .optionRow { display: flex; gap: 8px; align-items: center; }
        .optionRow input { flex: 1; }
        .removeBtn { background: none; border: none; color: #8c3a34; font-size: 14px; cursor: pointer; padding: 4px 8px; }
        .linkBtn { background: none; border: none; color: #2a78d6; font-size: 13px; cursor: pointer; padding: 0; text-align: left; align-self: flex-start; text-decoration: underline; }
        .rewardSuffix { font-size: 12.5px; color: #898781; }
        .submitBtn { padding: 10px 20px; border-radius: 999px; border: 1px solid #2a78d6; background: #2a78d6; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; align-self: flex-start; }
        .submitBtn:disabled { opacity: 0.6; cursor: default; }
        .hint { color: #898781; font-size: 12px; margin: 0; }
        .section h2 { font-size: 1.1rem; margin: 0 0 16px; }
        .tableWrap { overflow-x: auto; border: 1px solid #e1e0d9; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        th { text-align: left; padding: 10px 14px; background: #f9f9f7; color: #52514e; font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e1e0d9; }
        td { padding: 10px 14px; border-bottom: 1px solid #e1e0d9; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .muted { color: #898781; }
        .small { font-size: 12px; }
        .mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
        .empty { color: #898781; font-size: 13px; }
        @media (prefers-color-scheme: dark) {
          .lede { color: #c3c2b7; }
          .step input, .step select, .typeCard { background: #1a1a19; border-color: #2c2c2a; color: #fff; }
          .typeCardOn { border-color: #3987e5; background: #16233a; }
          .tableWrap { border-color: #2c2c2a; }
          th { background: #14161b; color: #c3c2b7; border-bottom-color: #2c2c2a; }
          td { border-bottom-color: #2c2c2a; }
          .errorBanner { background: #2e1f1e; border-color: #d98a83; color: #d98a83; }
          .successBanner { background: #123128; border-color: #63b0a3; color: #63b0a3; }
        }
      `,
        }}
      />
    </main>
  );
}
