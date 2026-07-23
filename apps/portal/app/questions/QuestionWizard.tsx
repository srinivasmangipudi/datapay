"use client";

import { useState, useTransition } from "react";
import { createQuestionAction } from "./actions";
import type { AnswerType } from "./core-api";

interface Category {
  id: number;
  name: string;
}

interface OptionRow {
  labelEn: string;
  labelKn: string;
}

const ANSWER_TYPES: { value: AnswerType; label: string; hint: string }[] = [
  { value: "single", label: "Single choice", hint: "Radio buttons — member picks exactly one" },
  { value: "multi", label: "Multiple choice", hint: "Checkboxes — member picks any number" },
  { value: "yesno", label: "Yes / No", hint: "A plain two-way question" },
  {
    value: "intent_window",
    label: "Buying intent",
    hint: "Yes / Maybe / No over a timeframe — the answer becomes a declared demand (LAW 2)",
  },
  { value: "numeric", label: "Number", hint: "Member types a number — no options needed" },
];

const INTENT_WINDOWS: { value: "1m" | "3m" | "6m" | "12m"; label: string }[] = [
  { value: "1m", label: "Next month" },
  { value: "3m", label: "Next 3 months" },
  { value: "6m", label: "Next 6 months" },
  { value: "12m", label: "Next year" },
];

function emptyOptions(count: number): OptionRow[] {
  return Array.from({ length: count }, () => ({ labelEn: "", labelKn: "" }));
}

export function QuestionWizard({ categories }: { categories: Category[] }): JSX.Element {
  const [categoryId, setCategoryId] = useState<number | "">(categories[0]?.id ?? "");
  const [textEn, setTextEn] = useState("");
  const [textKn, setTextKn] = useState("");
  const [type, setType] = useState<AnswerType>("single");
  const [options, setOptions] = useState<OptionRow[]>(emptyOptions(2));
  const [intentWindow, setIntentWindow] = useState<"1m" | "3m" | "6m" | "12m">("1m");
  const [rewardTokens, setRewardTokens] = useState(4);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectType(next: AnswerType) {
    setType(next);
    if (next === "yesno") {
      setOptions([
        { labelEn: "Yes", labelKn: "ಹೌದು" },
        { labelEn: "No", labelKn: "ಇಲ್ಲ" },
      ]);
    } else if (next === "single" || next === "multi") {
      if (options.length < 2) setOptions(emptyOptions(2));
    }
  }

  function updateOption(index: number, field: keyof OptionRow, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, { labelEn: "", labelKn: "" }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  const needsOptions = type === "single" || type === "multi" || type === "yesno";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!categoryId) {
      setClientError("Pick a category.");
      return;
    }
    if (!textEn.trim()) {
      setClientError("The question needs English text.");
      return;
    }
    if (needsOptions) {
      const filled = options.filter((o) => o.labelEn.trim());
      if (filled.length < 2) {
        setClientError("This answer type needs at least 2 options with English labels.");
        return;
      }
    }

    startTransition(() => {
      createQuestionAction({
        categoryId: Number(categoryId),
        textEn: textEn.trim(),
        textKn: textKn.trim() || undefined,
        type,
        rewardTokens,
        options: needsOptions
          ? options
              .filter((o) => o.labelEn.trim())
              .map((o) => ({ labelEn: o.labelEn.trim(), labelKn: o.labelKn.trim() || undefined }))
          : undefined,
        intentWindow: type === "intent_window" ? intentWindow : undefined,
      });
    });
  }

  return (
    <form className="wizard" onSubmit={handleSubmit}>
      {clientError && <div className="clientError">{clientError}</div>}

      <div className="step">
        <span className="stepLabel">1. Category &amp; question</span>
        <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Question text (English)"
          value={textEn}
          onChange={(e) => setTextEn(e.target.value)}
        />
        <input
          placeholder="Question text (Kannada) — optional"
          value={textKn}
          onChange={(e) => setTextKn(e.target.value)}
        />
      </div>

      <div className="step">
        <span className="stepLabel">2. Answer type</span>
        <div className="typeGrid">
          {ANSWER_TYPES.map((t) => (
            <label key={t.value} className={`typeCard ${type === t.value ? "typeCardOn" : ""}`}>
              <input
                type="radio"
                name="answerType"
                value={t.value}
                checked={type === t.value}
                onChange={() => selectType(t.value)}
              />
              <span className="typeCardLabel">{t.label}</span>
              <span className="typeCardHint">{t.hint}</span>
            </label>
          ))}
        </div>
      </div>

      {needsOptions && (
        <div className="step">
          <span className="stepLabel">3. Options</span>
          {options.map((opt, i) => (
            <div key={i} className="optionRow">
              <input
                placeholder={`Option ${i + 1} (English)`}
                value={opt.labelEn}
                onChange={(e) => updateOption(i, "labelEn", e.target.value)}
              />
              <input
                placeholder="Kannada — optional"
                value={opt.labelKn}
                onChange={(e) => updateOption(i, "labelKn", e.target.value)}
              />
              {options.length > 2 && (
                <button type="button" className="removeBtn" onClick={() => removeOption(i)}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="linkBtn" onClick={addOption}>
            + Add option
          </button>
        </div>
      )}

      {type === "intent_window" && (
        <div className="step">
          <span className="stepLabel">3. Timeframe</span>
          <select
            value={intentWindow}
            onChange={(e) => setIntentWindow(e.target.value as typeof intentWindow)}
          >
            {INTENT_WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <p className="hint">
            Options are fixed to Yes / Maybe / No — a "Yes" or "Maybe" answer becomes a declared
            purchase intent a member can later redeem tokens against (LAW 2).
          </p>
        </div>
      )}

      <div className="step">
        <span className="stepLabel">4. Reward</span>
        <input
          type="number"
          min={1}
          value={rewardTokens}
          onChange={(e) => setRewardTokens(Number(e.target.value))}
        />
        <span className="rewardSuffix">tokens for answering</span>
      </div>

      <button type="submit" className="submitBtn" disabled={isPending}>
        {isPending ? "Creating…" : "Create question"}
      </button>
      <p className="hint">
        No draft step — an admin authoring a question directly is itself the review (SPEC.md §14).
        It becomes selectable in Pulse immediately.
      </p>
    </form>
  );
}
