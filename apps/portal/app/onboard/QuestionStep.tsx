"use client";

import { useEffect, useState } from "react";
import { createQuestionDirectAction } from "./actions";
import type { AnswerType, DraftQuestion } from "./core-api";
import { listDraftQuestions } from "./core-api";

interface OptionRow {
  labelEn: string;
  labelKn: string;
}

// intent_window isn't offered here — it needs a required timeframe field
// this simplified step doesn't collect; use the full Questions page (kept
// as an advanced fallback) for that type.
const ANSWER_TYPES: { value: AnswerType; label: string }[] = [
  { value: "single", label: "Single choice" },
  { value: "multi", label: "Multiple choice" },
  { value: "yesno", label: "Yes / No" },
  { value: "numeric", label: "Number" },
  { value: "free_text", label: "Free text" },
];

// Manual path — author one question directly. Place and category are
// already decided (steps 1 and 3); this is just the content.
export function ManualQuestionStep({
  zoneId,
  categoryId,
  onCreated,
}: {
  zoneId: string | null;
  categoryId: number;
  onCreated: (questionId: number) => void;
}): JSX.Element {
  const [textEn, setTextEn] = useState("");
  const [type, setType] = useState<AnswerType>("single");
  const [options, setOptions] = useState<OptionRow[]>([
    { labelEn: "", labelKn: "" },
    { labelEn: "", labelKn: "" },
  ]);
  const [rewardTokens, setRewardTokens] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsOptions = type === "single" || type === "multi" || type === "yesno";

  async function handleSubmit() {
    if (!textEn.trim()) {
      setError("The question needs text.");
      return;
    }
    if (needsOptions && options.filter((o) => o.labelEn.trim()).length < 2) {
      setError("This answer type needs at least 2 options.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await createQuestionDirectAction({
        categoryId,
        textEn: textEn.trim(),
        type,
        rewardTokens,
        options: needsOptions
          ? options.filter((o) => o.labelEn.trim()).map((o) => ({ labelEn: o.labelEn.trim(), labelKn: o.labelKn.trim() || undefined }))
          : undefined,
        zoneId: zoneId ?? undefined,
        allowPhoto: true,
        allowVoice: true,
      });
      if (!result.ok || !result.data) {
        setError(result.message ?? "Couldn't create that question.");
        return;
      }
      onCreated(result.data.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="step">
      <span className="stepLabel">4. Write the question</span>

      <input placeholder="Question text (English)" value={textEn} onChange={(e) => setTextEn(e.target.value)} />

      <div className="typeGrid">
        {ANSWER_TYPES.map((t) => (
          <label key={t.value} className={`typeCard ${type === t.value ? "typeCardOn" : ""}`}>
            <input type="radio" checked={type === t.value} onChange={() => setType(t.value)} />
            <span className="typeCardLabel">{t.label}</span>
          </label>
        ))}
      </div>

      {needsOptions && (
        <>
          {options.map((opt, i) => (
            <div key={i} className="optionRow">
              <input
                placeholder={`Option ${i + 1}`}
                value={opt.labelEn}
                onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, labelEn: e.target.value } : o)))}
              />
              <input
                placeholder="Kannada — optional"
                value={opt.labelKn}
                onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, labelKn: e.target.value } : o)))}
              />
            </div>
          ))}
          <button type="button" className="linkBtn" onClick={() => setOptions((prev) => [...prev, { labelEn: "", labelKn: "" }])}>
            + Add option
          </button>
        </>
      )}

      <input type="number" min={1} value={rewardTokens} onChange={(e) => setRewardTokens(Number(e.target.value))} />
      <span className="rewardSuffix">tokens for answering</span>

      {error && <div className="clientError">{error}</div>}

      <button type="button" className="submitBtn" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Creating…" : "Create — this goes live immediately →"}
      </button>
      <p className="hint">
        No draft step — you authoring it directly is itself the review (SPEC.md §14/§21).
      </p>
    </div>
  );
}

// AI-drafted path — read-only view of what generateNow() just produced
// (matched client-side by generation_run_id, since there's no dedicated
// "questions from this run" endpoint). Editing generated content would need
// a PATCH /v1/admin/questions/:id endpoint that doesn't exist yet.
export function AiDraftedQuestionStep({
  runId,
  questionsGenerated,
  onContinue,
}: {
  runId: number;
  questionsGenerated: number;
  onContinue: (drafts: DraftQuestion[]) => void;
}): JSX.Element {
  const [drafts, setDrafts] = useState<DraftQuestion[] | null>(null);

  useEffect(() => {
    listDraftQuestions().then((all) => {
      setDrafts(all.filter((q) => q.generation_run_id === runId));
    });
  }, [runId]);

  return (
    <div className="step">
      <span className="stepLabel">4. What got drafted</span>

      {drafts === null && <p className="hint">Loading…</p>}
      {drafts !== null && drafts.length === 0 && (
        <p className="empty">
          The run reported {questionsGenerated} question(s) generated, but they're not showing up
          here yet — try continuing to the review step, they may just need a moment.
        </p>
      )}
      {drafts !== null && drafts.length > 0 && (
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
                  <td className="num value">{q.reward_tokens} ◈</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        className="submitBtn"
        style={{ marginTop: 16 }}
        onClick={() => onContinue(drafts ?? [])}
        disabled={drafts === null}
      >
        Continue to review →
      </button>
    </div>
  );
}
