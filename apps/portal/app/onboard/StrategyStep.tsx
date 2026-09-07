"use client";

import { useState } from "react";
import { createTopicAndRunAction, resolveCategoryAction } from "./actions";

export interface Category {
  id: number;
  name: string;
}

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: "Just this once (no schedule)", value: "" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Weekly, Monday 6am", value: "0 6 * * 1" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
];

export function StrategyStep({
  categories,
  zoneId,
  hasUnderstanding,
  onBackToIntelligence,
  onManual,
  onAiGenerated,
}: {
  categories: Category[];
  zoneId: string | null;
  hasUnderstanding: boolean;
  onBackToIntelligence: () => void;
  onManual: (categoryId: number, categoryName: string) => void;
  onAiGenerated: (categoryId: number, categoryName: string, runId: number, questionsGenerated: number) => void;
}): JSX.Element {
  const [categoryName, setCategoryName] = useState(categories[0]?.name ?? "");
  const [strategy, setStrategy] = useState<"manual" | "ai">("manual");
  const [slug, setSlug] = useState("");
  const [questionCount, setQuestionCount] = useState(3);
  const [focusAreas, setFocusAreas] = useState("");
  const [toneNote, setToneNote] = useState("");
  const [scheduleCron, setScheduleCron] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!categoryName.trim()) {
      setError("Pick or type a category.");
      return;
    }
    if (strategy === "ai" && !zoneId) {
      setError("AI drafting needs a place — go back to step 1 and pick one, or use Global with 'Write it myself.'");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const category = await resolveCategoryAction(categoryName.trim());
      if (!category.ok || !category.data) {
        setError(category.message ?? "Couldn't resolve that category.");
        return;
      }

      if (strategy === "manual") {
        onManual(category.data.id, categoryName.trim());
        return;
      }

      if (!slug.trim()) {
        setError("Give this a short slug, e.g. 'sugar-price-check'.");
        return;
      }
      const result = await createTopicAndRunAction({
        slug: slug.trim(),
        name: `${categoryName.trim()} — ${new Date().toLocaleDateString()}`,
        categoryId: category.data.id,
        zoneId: zoneId!,
        scheduleCron: scheduleCron || undefined,
        config: {
          questionCount,
          focusAreas: focusAreas.trim() ? focusAreas.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          toneNote: toneNote.trim() || undefined,
        },
      });
      if (!result.ok || !result.data) {
        setError(result.message ?? "Couldn't generate questions.");
        return;
      }
      onAiGenerated(category.data.id, categoryName.trim(), result.data.runId, result.data.questionsGenerated);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="step">
      <span className="stepLabel">3. What's this about, and who writes it?</span>

      <input
        list="strategyCategoryOptions"
        placeholder="Category — pick existing or type a new one"
        value={categoryName}
        onChange={(e) => setCategoryName(e.target.value)}
      />
      <datalist id="strategyCategoryOptions">
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

      <div className="typeGrid" style={{ marginTop: 12 }}>
        <label className={`typeCard ${strategy === "manual" ? "typeCardOn" : ""}`}>
          <input type="radio" checked={strategy === "manual"} onChange={() => setStrategy("manual")} />
          <span className="typeCardLabel">Write it myself</span>
          <span className="typeCardHint">You author the question text and options directly.</span>
        </label>
        <label className={`typeCard ${strategy === "ai" ? "typeCardOn" : ""}`}>
          <input type="radio" checked={strategy === "ai"} onChange={() => setStrategy("ai")} />
          <span className="typeCardLabel">Let AI draft from local knowledge</span>
          <span className="typeCardHint">Drafts from what was ingested about this place in step 2.</span>
        </label>
      </div>

      {strategy === "ai" && !hasUnderstanding && (
        <div className="errorBanner" style={{ marginTop: 12 }}>
          <strong>Nothing ingested for this place yet.</strong>{" "}
          <button type="button" className="linkBtn" onClick={onBackToIntelligence}>
            Go back to step 2 →
          </button>
        </div>
      )}

      {strategy === "ai" && (
        <div style={{ marginTop: 12 }}>
          <input placeholder="Slug, e.g. 'sugar-price-check'" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <input
            type="number"
            min={1}
            max={10}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            placeholder="How many questions"
          />
          <input
            placeholder="Focus areas, comma-separated — optional"
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
          />
          <input placeholder="Tone note — optional" value={toneNote} onChange={(e) => setToneNote(e.target.value)} />
          <select value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)}>
            {SCHEDULE_PRESETS.map((p) => (
              <option key={p.label} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="hint">
            Runs once right now either way — a schedule just adds future runs on top (SPEC.md §24).
          </p>
        </div>
      )}

      {error && <div className="clientError">{error}</div>}

      <button type="button" className="submitBtn" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Working…" : strategy === "manual" ? "Continue →" : "Generate now →"}
      </button>
    </div>
  );
}
