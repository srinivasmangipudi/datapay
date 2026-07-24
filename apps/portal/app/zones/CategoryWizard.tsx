"use client";

import { useState, useTransition } from "react";
import { createCategoryAction } from "./actions";

export function CategoryWizard(): JSX.Element {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [nameKn, setNameKn] = useState("");
  const [sensitivity, setSensitivity] = useState<"standard" | "none">("standard");
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    if (!slug.trim() || !name.trim()) {
      setClientError("Slug and name are required.");
      return;
    }
    startTransition(() => {
      createCategoryAction({
        slug: slug.trim(),
        name: name.trim(),
        nameKn: nameKn.trim() || undefined,
        sensitivity,
      });
    });
  }

  return (
    <form className="wizard" onSubmit={handleSubmit}>
      {clientError && <div className="clientError">{clientError}</div>}
      <div className="step">
        <span className="stepLabel">New category</span>
        <input placeholder="Slug, e.g. 'toothpaste'" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input placeholder="Name (English)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Name (Kannada) — optional" value={nameKn} onChange={(e) => setNameKn(e.target.value)} />
        <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value as typeof sensitivity)}>
          <option value="standard">Standard</option>
          <option value="none">None (no sensitivity concerns)</option>
        </select>
        <button type="submit" className="submitBtn" disabled={isPending}>
          {isPending ? "Creating…" : "Create category"}
        </button>
      </div>
    </form>
  );
}
