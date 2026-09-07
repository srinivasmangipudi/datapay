"use client";

import { useState } from "react";
import { reviewDraftAction } from "./actions";
import type { DraftQuestion } from "./core-api";

// Manual path: nothing to review — authoring it directly already made it
// live (question-feeder.service.ts's createDirectQuestion sets
// review_state='approved' immediately, same as the standalone Questions page).
export function ManualReviewStep({ onRestart }: { onRestart: () => void }): JSX.Element {
  return (
    <div className="step">
      <span className="stepLabel">5. Done</span>
      <div className="successBanner">
        <strong>Live.</strong> Nothing further to review — you authoring it directly was the review.
      </div>
      <button type="button" className="submitBtn" style={{ marginTop: 16 }} onClick={onRestart}>
        Onboard another question →
      </button>
    </div>
  );
}

export function AiReviewStep({
  drafts,
  onRestart,
}: {
  drafts: DraftQuestion[];
  onRestart: () => void;
}): JSX.Element {
  const [decided, setDecided] = useState<Record<number, "approve" | "reject">>({});
  const [working, setWorking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(questionId: number, decision: "approve" | "reject") {
    setError(null);
    setWorking(questionId);
    try {
      const result = await reviewDraftAction(questionId, decision);
      if (!result.ok) {
        setError(result.message ?? "Couldn't record that decision.");
        return;
      }
      setDecided((prev) => ({ ...prev, [questionId]: decision }));
    } finally {
      setWorking(null);
    }
  }

  const allDecided = drafts.length > 0 && drafts.every((d) => decided[d.id]);
  const approvedCount = Object.values(decided).filter((d) => d === "approve").length;

  return (
    <div className="step">
      <span className="stepLabel">5. Review what got drafted</span>

      {drafts.length === 0 && <p className="empty">Nothing to review.</p>}

      {error && <div className="clientError">{error}</div>}

      {drafts.length > 0 && !allDecided && (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drafts.map((q) => (
                <tr key={q.id}>
                  <td>
                    {q.text_en}
                    {decided[q.id] && <div className="muted small">Marked: {decided[q.id]}</div>}
                  </td>
                  <td className="mono small">{q.type}</td>
                  <td className="actions">
                    {!decided[q.id] && (
                      <>
                        <button type="button" className="approveBtn" onClick={() => decide(q.id, "approve")} disabled={working === q.id}>
                          Approve
                        </button>
                        <button type="button" className="rejectBtn" onClick={() => decide(q.id, "reject")} disabled={working === q.id}>
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {allDecided && (
        <div className="successBanner">
          <strong>
            {approvedCount} of {drafts.length} question(s) approved and live.
          </strong>
        </div>
      )}

      <button type="button" className="submitBtn" style={{ marginTop: 16 }} onClick={onRestart}>
        Onboard another question →
      </button>
    </div>
  );
}
