"use client";

import { useState, useTransition } from "react";
import type { AnswerType, Category } from "../core-api";
import { submitOrgQuestionAction } from "./actions";

interface OptionRow {
  labelEn: string;
  labelKn: string;
}

const ANSWER_TYPES: { value: AnswerType; label: string; hint: string }[] = [
  { value: "single", label: "Single choice", hint: "Radio buttons — member picks exactly one" },
  { value: "multi", label: "Multiple choice", hint: "Checkboxes — member picks any number" },
  { value: "yesno", label: "Yes / No", hint: "A plain two-way question" },
  { value: "intent_window", label: "Buying intent", hint: "Yes / Maybe / No over a timeframe" },
  { value: "numeric", label: "Number", hint: "Member types a number — no options needed" },
  { value: "free_text", label: "Free text", hint: "Member types their own answer — no options needed" },
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

export function OrgQuestionForm({ categories }: { categories: Category[] }): JSX.Element {
  const [categoryId, setCategoryId] = useState<number | "">(categories[0]?.id ?? "");
  const [textEn, setTextEn] = useState("");
  const [type, setType] = useState<AnswerType>("single");
  const [options, setOptions] = useState<OptionRow[]>(emptyOptions(2));
  const [intentWindow, setIntentWindow] = useState<"1m" | "3m" | "6m" | "12m">("1m");
  const [rewardTokens, setRewardTokens] = useState(1);
  const [allowPhoto, setAllowPhoto] = useState(true);
  const [allowVoice, setAllowVoice] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsOptions = type === "single" || type === "multi" || type === "yesno";

  function selectType(next: AnswerType) {
    setType(next);
    if (next === "yesno") {
      setOptions([
        { labelEn: "Yes", labelKn: "" },
        { labelEn: "No", labelKn: "" },
      ]);
    } else if ((next === "single" || next === "multi") && options.length < 2) {
      setOptions(emptyOptions(2));
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (categoryId === "") {
      setClientError("Pick a category.");
      return;
    }
    if (!textEn.trim()) {
      setClientError("The question needs text.");
      return;
    }
    if (needsOptions) {
      const filled = options.filter((o) => o.labelEn.trim());
      if (filled.length < 2) {
        setClientError("This answer type needs at least 2 options.");
        return;
      }
    }

    startTransition(() => {
      submitOrgQuestionAction({
        categoryId,
        textEn: textEn.trim(),
        type,
        rewardTokens,
        options: needsOptions
          ? options
              .filter((o) => o.labelEn.trim())
              .map((o) => ({ labelEn: o.labelEn.trim(), labelKn: o.labelKn.trim() || undefined }))
          : undefined,
        intentWindow: type === "intent_window" ? intentWindow : undefined,
        allowPhoto,
        allowVoice,
      });
    });
  }

  return (
    <form className="wizard" onSubmit={handleSubmit}>
      {clientError && <div className="clientError">{clientError}</div>}

      <div className="step">
        <span className="stepLabel">1. Category &amp; question</span>
        <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.length === 0 && <option value="">No categories yet</option>}
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
                placeholder={`Option ${i + 1}`}
                value={opt.labelEn}
                onChange={(e) => updateOption(i, "labelEn", e.target.value)}
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
        </div>
      )}

      <div className="step">
        <span className="stepLabel">4. Evidence</span>
        <label className="checkboxRow">
          <input type="checkbox" checked={allowPhoto} onChange={(e) => setAllowPhoto(e.target.checked)} />
          Allow a photo as evidence
        </label>
        <label className="checkboxRow">
          <input type="checkbox" checked={allowVoice} onChange={(e) => setAllowVoice(e.target.checked)} />
          Allow a voice note as evidence
        </label>
      </div>

      <div className="step">
        <span className="stepLabel">5. Reward</span>
        <input
          type="number"
          min={1}
          value={rewardTokens}
          onChange={(e) => setRewardTokens(Number(e.target.value))}
        />
        <span className="rewardSuffix">tokens for answering</span>
      </div>

      <button type="submit" className="submitBtn" disabled={isPending || categories.length === 0}>
        {isPending ? "Submitting…" : "Submit for review"}
      </button>
      <p className="hint">
        Goes into DataPay's review queue — an ops reviewer approves it before it can reach any
        member, same as every other generated question.
      </p>
    </form>
  );
}
