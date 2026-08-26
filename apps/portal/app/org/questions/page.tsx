import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listCategories, listOwnQuestions } from "../core-api";
import { OrgQuestionForm } from "./OrgQuestionForm";

export const dynamic = "force-dynamic";

const REVIEW_STATE_LABEL: Record<string, string> = {
  draft: "Awaiting review",
  approved: "Live",
  rejected: "Not approved",
};

export default async function OrgQuestionsPage({
  searchParams,
}: {
  searchParams: { error?: string; submitted?: string };
}): Promise<JSX.Element> {
  const token = cookies().get("org_session")?.value;
  if (!token) redirect("/org/login");

  const [categories, ownQuestions] = await Promise.all([listCategories(), listOwnQuestions(token)]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Organization</p>
      <h1>Submit a question</h1>
      <p className="lede">
        Pick a category, write your question, choose how members answer it. Every question you
        submit goes into DataPay's review queue first — an ops reviewer approves it before it can
        ever reach a member.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Couldn't submit question:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.submitted && (
        <div className="successBanner">Submitted — it's now awaiting review.</div>
      )}

      <OrgQuestionForm categories={categories} />

      <section className="section">
        <h2>Your questions ({ownQuestions.length})</h2>
        {ownQuestions.length === 0 && <p className="empty">Nothing submitted yet.</p>}
        {ownQuestions.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                {ownQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>{q.text_en}</td>
                    <td className="mono small">{q.type}</td>
                    <td className="small">{REVIEW_STATE_LABEL[q.review_state] ?? q.review_state}</td>
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
