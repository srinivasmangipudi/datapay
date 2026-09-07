"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createTopicAction,
  getZoneUnderstandingStatus,
  ingestLinkAction,
  translateToKannada,
  type IngestStatus,
} from "./actions";
import type { GeneratorKind } from "./core-api";

interface Category {
  id: number;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  level: string;
}

interface OptionRow {
  labelEn: string;
  labelKn: string;
}

const ANSWER_TYPES = [
  { value: "single", label: "Single choice" },
  { value: "multi", label: "Multiple choice" },
  { value: "yesno", label: "Yes / No" },
  { value: "intent_window", label: "Buying intent" },
  { value: "numeric", label: "Number" },
  { value: "free_text", label: "Free text" },
] as const;

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: "Manual only (no schedule)", value: "" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Weekly, Monday 6am", value: "0 6 * * 1" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
];

export function TopicWizard({ categories, zones }: { categories: Category[]; zones: Zone[] }): JSX.Element {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [categoryName, setCategoryName] = useState(categories[0]?.name ?? "");
  const [generatorKind, setGeneratorKind] = useState<GeneratorKind>("template");
  const [zoneId, setZoneId] = useState("");
  const [scheduleCron, setScheduleCron] = useState("");

  // 'template' kind config — one variant per topic for now (create multiple
  // topics for multiple variants; see the hint text below).
  const [textEn, setTextEn] = useState("");
  const [textKn, setTextKn] = useState("");
  const [type, setType] = useState<(typeof ANSWER_TYPES)[number]["value"]>("single");
  const [options, setOptions] = useState<OptionRow[]>([
    { labelEn: "", labelKn: "" },
    { labelEn: "", labelKn: "" },
  ]);
  const [rewardTokens, setRewardTokens] = useState(1);

  // 'document_grounded' kind config
  const [questionCount, setQuestionCount] = useState(3);
  const [focusAreas, setFocusAreas] = useState("");
  const [toneNote, setToneNote] = useState("");

  // Ingestion status for whatever zone is currently selected — only
  // meaningful (and only fetched) for document_grounded topics.
  const [linkUrl, setLinkUrl] = useState("");
  const [ingestStatus, setIngestStatus] = useState<IngestStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTranslating, setIsTranslating] = useState(false);

  const needsOptions = type === "single" || type === "multi" || type === "yesno";

  useEffect(() => {
    if (generatorKind !== "document_grounded" || !zoneId) {
      setIngestStatus(null);
      return;
    }
    setCheckingStatus(true);
    getZoneUnderstandingStatus(zoneId)
      .then(setIngestStatus)
      .finally(() => setCheckingStatus(false));
  }, [generatorKind, zoneId]);

  async function handleIngest() {
    if (!zoneId || !linkUrl.trim()) return;
    setIngesting(true);
    try {
      setIngestStatus(await ingestLinkAction(zoneId, linkUrl.trim()));
      setLinkUrl("");
    } finally {
      setIngesting(false);
    }
  }

  async function handleTranslate() {
    if (!textEn.trim()) {
      setClientError("Type the English variant text first.");
      return;
    }
    setClientError(null);
    setIsTranslating(true);
    try {
      setTextKn(await translateToKannada(textEn.trim()));
    } catch (err) {
      setClientError((err as Error).message);
    } finally {
      setIsTranslating(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!slug.trim() || !name.trim()) {
      setClientError("Slug and name are required.");
      return;
    }
    if (!categoryName.trim()) {
      setClientError("Pick or type a category.");
      return;
    }
    if (generatorKind === "document_grounded" && !zoneId) {
      setClientError("document_grounded topics need a zone — that's what its questions are grounded in.");
      return;
    }

    let config: Record<string, unknown>;
    if (generatorKind === "template") {
      if (!textEn.trim()) {
        setClientError("The variant needs English text.");
        return;
      }
      if (needsOptions && options.filter((o) => o.labelEn.trim()).length < 2) {
        setClientError("This answer type needs at least 2 options.");
        return;
      }
      config = {
        variants: [
          {
            textEn: textEn.trim(),
            textKn: textKn.trim() || undefined,
            type,
            rewardTokens,
            options: needsOptions
              ? options
                  .filter((o) => o.labelEn.trim())
                  .map((o) => ({ labelEn: o.labelEn.trim(), labelKn: o.labelKn.trim() || undefined }))
              : undefined,
          },
        ],
      };
    } else {
      config = {
        questionCount,
        focusAreas: focusAreas.trim()
          ? focusAreas.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        toneNote: toneNote.trim() || undefined,
      };
    }

    startTransition(() => {
      createTopicAction({
        slug: slug.trim(),
        name: name.trim(),
        categoryName: categoryName.trim(),
        generatorKind,
        config,
        scheduleCron: scheduleCron || undefined,
        zoneId: zoneId || undefined,
      });
    });
  }

  return (
    <form className="wizard" onSubmit={handleSubmit}>
      {clientError && <div className="clientError">{clientError}</div>}

      <div className="step">
        <span className="stepLabel">1. Identity</span>
        <input placeholder="Slug, e.g. 'sugar-price-check'" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input placeholder="Name, e.g. 'Sugar price check'" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          list="topicCategoryOptions"
          placeholder="Category — pick existing or type a new one"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />
        <datalist id="topicCategoryOptions">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>

      <div className="step">
        <span className="stepLabel">2. Generator</span>
        <div className="typeGrid">
          <label className={`typeCard ${generatorKind === "template" ? "typeCardOn" : ""}`}>
            <input type="radio" checked={generatorKind === "template"} onChange={() => setGeneratorKind("template")} />
            <span className="typeCardLabel">Template</span>
            <span className="typeCardHint">You hand-write the question variant below.</span>
          </label>
          <label className={`typeCard ${generatorKind === "document_grounded" ? "typeCardOn" : ""}`}>
            <input
              type="radio"
              checked={generatorKind === "document_grounded"}
              onChange={() => setGeneratorKind("document_grounded")}
            />
            <span className="typeCardLabel">Document-grounded</span>
            <span className="typeCardHint">
              An LLM drafts questions from a zone's ingested-document understanding (SPEC.md §20).
            </span>
          </label>
        </div>
      </div>

      <div className="step">
        <span className="stepLabel">3. Region {generatorKind === "document_grounded" ? "(required)" : "(optional)"}</span>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">{generatorKind === "document_grounded" ? "— pick a zone —" : "Global — every member, everywhere"}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} ({z.level})
            </option>
          ))}
        </select>

        {generatorKind === "document_grounded" && zoneId && (
          <div className="ingestPanel">
            {checkingStatus && <p className="hint">Checking what's already known about this zone…</p>}

            {!checkingStatus && ingestStatus?.ready && (
              <div className="successBanner" style={{ marginTop: 0 }}>
                <strong>This zone is ready to generate from.</strong>
                <p style={{ margin: "4px 0 0" }}>{ingestStatus.message}</p>
              </div>
            )}

            {!checkingStatus && ingestStatus && !ingestStatus.ready && (
              <div className="errorBanner" style={{ marginTop: 0 }}>
                <strong>Nothing to generate from yet:</strong> {ingestStatus.message}
              </div>
            )}

            <p className="hint" style={{ marginTop: 8 }}>
              Paste a link to an article, report, or page about this area — it gets read and
              summarized into what "Generate now" will draft questions from. Add as many as you
              like; each one adds to the same understanding.
            </p>
            <div className="optionRow">
              <input
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <button type="button" className="linkBtn" onClick={handleIngest} disabled={ingesting || !linkUrl.trim()}>
                {ingesting ? "Reading & summarizing…" : "Ingest this link"}
              </button>
            </div>
          </div>
        )}
      </div>

      {generatorKind === "template" ? (
        <>
          <div className="step">
            <span className="stepLabel">4. Question variant</span>
            <p className="hint">
              One variant per topic for now — create another topic for a second variant.
            </p>
            <input placeholder="Question text (English)" value={textEn} onChange={(e) => setTextEn(e.target.value)} />
            <input placeholder="Question text (Kannada) — optional" value={textKn} onChange={(e) => setTextKn(e.target.value)} />
            <button type="button" className="linkBtn" onClick={handleTranslate} disabled={isTranslating}>
              {isTranslating ? "Translating…" : "Translate to Kannada →"}
            </button>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {ANSWER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {needsOptions && (
            <div className="step">
              <span className="stepLabel">5. Options</span>
              {options.map((opt, i) => (
                <div key={i} className="optionRow">
                  <input
                    placeholder={`Option ${i + 1} (English)`}
                    value={opt.labelEn}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, labelEn: e.target.value } : o)))
                    }
                  />
                  <input
                    placeholder="Kannada — optional"
                    value={opt.labelKn}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, labelKn: e.target.value } : o)))
                    }
                  />
                </div>
              ))}
              <button type="button" className="linkBtn" onClick={() => setOptions((prev) => [...prev, { labelEn: "", labelKn: "" }])}>
                + Add option
              </button>
            </div>
          )}

          <div className="step">
            <span className="stepLabel">6. Reward</span>
            <input type="number" min={1} value={rewardTokens} onChange={(e) => setRewardTokens(Number(e.target.value))} />
          </div>
        </>
      ) : (
        <div className="step">
          <span className="stepLabel">4. Generation settings</span>
          <input
            type="number"
            min={1}
            max={10}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            placeholder="How many questions per run"
          />
          <input
            placeholder="Focus areas, comma-separated — optional"
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
          />
          <input placeholder="Tone note — optional" value={toneNote} onChange={(e) => setToneNote(e.target.value)} />
        </div>
      )}

      <div className="step">
        <span className="stepLabel">{generatorKind === "template" ? "7" : "5"}. Schedule</span>
        <select value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)}>
          {SCHEDULE_PRESETS.map((p) => (
            <option key={p.label} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Or a custom cron expression"
          value={scheduleCron}
          onChange={(e) => setScheduleCron(e.target.value)}
        />
        <p className="hint">
          Manual only means you trigger generation yourself with "Generate now" below — nothing
          runs unattended (SPEC.md §24).
        </p>
      </div>

      <button type="submit" className="submitBtn" disabled={isPending}>
        {isPending ? "Creating…" : "Create topic"}
      </button>
      <p className="hint">
        Generated questions always land as drafts awaiting review — this never bypasses the review
        queue (SPEC.md §14).
      </p>
    </form>
  );
}
