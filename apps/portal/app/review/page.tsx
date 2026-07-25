import { reviewQuestionAction } from "./actions";
import { listDraftQuestions } from "./core-api";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: { error?: string };
}): Promise<JSX.Element> {
  const drafts = await listDraftQuestions();

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Review queue</h1>
      <p className="lede">
        Every generated question — template or document-grounded, from any zone or global — lands
        here as a draft before it can ever reach a member (SPEC.md §14). Nothing is auto-approved.
        This is the cross-zone view; the same queue is also filterable per-zone on the Area
        Intelligence page.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Action failed:</strong> {searchParams.error}
        </div>
      )}

      <section className="section">
        <h2>Awaiting review ({drafts.length})</h2>
        {drafts.length === 0 && <p className="empty">Nothing in the queue right now.</p>}
        {drafts.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {drafts.map((q) => (
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
                    <td className="muted small">{q.source}</td>
                    <td className="actions">
                      <form action={reviewQuestionAction}>
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button type="submit" className="approveBtn">
                          Approve
                        </button>
                      </form>
                      <form action={reviewQuestionAction}>
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button type="submit" className="rejectBtn">
                          Reject
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
