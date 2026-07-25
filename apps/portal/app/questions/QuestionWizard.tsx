"use client";

import { useState, useTransition } from "react";
import { LANGUAGE_NAMES } from "../lib/language-names";
import { createQuestionAction, translateQuestionText } from "./actions";
import type { AnswerType } from "./core-api";

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

const LEVEL_INDENT: Record<string, string> = {
  constituency: "",
  hobli: "— ",
  panchayat: "—— ",
  village: "——— ",
};

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

export function QuestionWizard({
  categories,
  zones,
}: {
  categories: Category[];
  zones: Zone[];
}): JSX.Element {
  const [categoryName, setCategoryName] = useState(categories[0]?.name ?? "");
  const [textEn, setTextEn] = useState("");
  const [textHi, setTextHi] = useState("");
  const [textLocal, setTextLocal] = useState("");
  const [type, setType] = useState<AnswerType>("single");
  const [options, setOptions] = useState<OptionRow[]>(emptyOptions(2));
  const [intentWindow, setIntentWindow] = useState<"1m" | "3m" | "6m" | "12m">("1m");
  const [rewardTokens, setRewardTokens] = useState(4);
  const [zoneId, setZoneId] = useState<string>("");
  const [allowPhoto, setAllowPhoto] = useState(true);
  const [allowVoice, setAllowVoice] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);

  // SPEC.md §39 — the local-language button only appears once a zone is
  // scoped and its language is known; "hi"/"en" don't get a second button
  // since Hindi already has its own field and English is the base text.
  const selectedZone = zones.find((z) => z.id === zoneId);
  const localLanguageCode =
    selectedZone?.languageCode && selectedZone.languageCode !== "hi" && selectedZone.languageCode !== "en"
      ? selectedZone.languageCode
      : null;

  async function handleTranslate(targetLang: string, setText: (text: string) => void) {
    if (!textEn.trim()) {
      setClientError("Type the English question first.");
      return;
    }
    setClientError(null);
    setTranslatingLang(targetLang);
    try {
      const translated = await translateQuestionText(textEn.trim(), targetLang);
      setText(translated);
    } catch (err) {
      setClientError((err as Error).message);
    } finally {
      setTranslatingLang(null);
    }
  }

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

    if (!categoryName.trim()) {
      setClientError("Pick or type a category.");
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

    const translations = [
      ...(textHi.trim() ? [{ languageCode: "hi", text: textHi.trim() }] : []),
      ...(localLanguageCode && textLocal.trim() ? [{ languageCode: localLanguageCode, text: textLocal.trim() }] : []),
    ];

    startTransition(() => {
      createQuestionAction({
        categoryName: categoryName.trim(),
        textEn: textEn.trim(),
        translations: translations.length ? translations : undefined,
        type,
        rewardTokens,
        options: needsOptions
          ? options
              .filter((o) => o.labelEn.trim())
              .map((o) => ({ labelEn: o.labelEn.trim(), labelKn: o.labelKn.trim() || undefined }))
          : undefined,
        intentWindow: type === "intent_window" ? intentWindow : undefined,
        zoneId: zoneId || undefined,
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
        <input
          list="categoryOptions"
          placeholder="Category — pick existing or type a new one"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />
        <datalist id="categoryOptions">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <p className="hint">
          Typing a name that doesn't exist yet creates it — no need to visit Zones &amp; Categories
          first (SPEC.md §26).
        </p>
        <input
          placeholder="Question text (English)"
          value={textEn}
          onChange={(e) => setTextEn(e.target.value)}
        />
        <input
          placeholder="Question text (Hindi) — optional"
          value={textHi}
          onChange={(e) => setTextHi(e.target.value)}
        />
        <button
          type="button"
          className="linkBtn"
          onClick={() => handleTranslate("hi", setTextHi)}
          disabled={translatingLang !== null}
        >
          {translatingLang === "hi" ? "Translating…" : "Translate to Hindi →"}
        </button>
        {localLanguageCode && (
          <>
            <input
              placeholder={`Question text (${LANGUAGE_NAMES[localLanguageCode] ?? localLanguageCode}) — optional`}
              value={textLocal}
              onChange={(e) => setTextLocal(e.target.value)}
            />
            <button
              type="button"
              className="linkBtn"
              onClick={() => handleTranslate(localLanguageCode, setTextLocal)}
              disabled={translatingLang !== null}
            >
              {translatingLang === localLanguageCode
                ? "Translating…"
                : `Translate to ${LANGUAGE_NAMES[localLanguageCode] ?? localLanguageCode} →`}
            </button>
          </>
        )}
        <p className="hint">
          Auto-translated by Gemini — always a starting draft, review and edit before creating the
          question (SPEC.md §27). English is always shown; Hindi and the region's local language
          (from step 4) fill in when set (SPEC.md §39).
        </p>
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
        <span className="stepLabel">4. Region</span>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">Global — every member, everywhere</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {LEVEL_INDENT[z.level] ?? ""}
              {z.name}
            </option>
          ))}
        </select>
        <p className="hint">
          Scoping to a zone reaches that zone and every zone beneath it (e.g. a constituency
          reaches every village in it) — never a sibling zone at the same level.
        </p>
      </div>

      <div className="step">
        <span className="stepLabel">5. Evidence</span>
        <label className="checkboxRow">
          <input type="checkbox" checked={allowPhoto} onChange={(e) => setAllowPhoto(e.target.checked)} />
          Allow a photo as evidence
        </label>
        <label className="checkboxRow">
          <input type="checkbox" checked={allowVoice} onChange={(e) => setAllowVoice(e.target.checked)} />
          Allow a voice note as evidence
        </label>
        <p className="hint">
          Both on by default — turn either off if this question shouldn't offer that input at all
          (SPEC.md §34). The member's own tap/typed answer is never affected either way.
        </p>
      </div>

      <div className="step">
        <span className="stepLabel">6. Reward</span>
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
