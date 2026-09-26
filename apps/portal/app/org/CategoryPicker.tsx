"use client";

import type { Category } from "./core-api";

/**
 * Type-to-pick, type-to-create. Mirrors the ops question wizard's category
 * input rather than the fixed <select> the org portal used to have.
 *
 * A native <datalist> on purpose: it gives free text plus an existing-value
 * dropdown with no custom popup, no keyboard trapping, and no dependency —
 * and the backend resolves by slug, so picking "Rice" and typing "rice"
 * land on the same category rather than making a second one.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  id = "orgCategoryOptions",
  allowEmpty = false,
}: {
  categories: Category[];
  value: string;
  onChange: (next: string) => void;
  id?: string;
  allowEmpty?: boolean;
}): JSX.Element {
  const match = categories.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
  const isNew = value.trim().length > 0 && !match;

  return (
    <>
      <input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          allowEmpty ? "Category — optional, pick or type a new one" : "Category — pick or type a new one"
        }
        aria-label="Category"
      />
      <datalist id={id}>
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <p className="hint">
        {isNew ? (
          <>
            <strong>&ldquo;{value.trim()}&rdquo;</strong> doesn&apos;t exist yet — it&apos;ll be
            created when you save.
          </>
        ) : (
          "Pick an existing category, or type a new name to create it."
        )}
      </p>
    </>
  );
}
