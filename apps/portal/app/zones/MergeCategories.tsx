"use client";

import { useState, useTransition } from "react";
import { getCategoryUsageAction, mergeCategoriesAction } from "./actions";

/** Only what the picker needs — avoids importing the org area's Category
    type into an ops page just because the shapes happen to line up. */
interface CategoryOption {
  id: number;
  name: string;
}

interface Usage {
  name: string;
  references: Array<{ table: string; column: string; count: number }>;
  total: number;
}

/**
 * Merging is not reversible, so this is deliberately two steps: pick the pair,
 * see exactly how many rows move and from which tables, then confirm.
 */
export function MergeCategories({ categories }: { categories: CategoryOption[] }): JSX.Element {
  const [sourceId, setSourceId] = useState<number | "">("");
  const [targetId, setTargetId] = useState<number | "">("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sameCategory = sourceId !== "" && sourceId === targetId;
  const ready = sourceId !== "" && targetId !== "" && !sameCategory;

  function preview() {
    setError(null);
    setDone(null);
    startTransition(() => {
      void (async () => {
        const result = await getCategoryUsageAction(Number(sourceId));
        if (result.ok) setUsage(result.data);
        else setError(result.message);
      })();
    });
  }

  function confirm() {
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await mergeCategoriesAction(Number(sourceId), Number(targetId));
        if (result.ok) {
          const moved = result.data.moved.reduce((n, m) => n + m.count, 0);
          setDone(
            `Merged “${result.data.movedFrom.name}” into “${result.data.into.name}” — ${moved} row${moved === 1 ? "" : "s"} moved.`
          );
          setUsage(null);
          setSourceId("");
          setTargetId("");
        } else {
          setError(result.message);
        }
      })();
    });
  }

  const sourceName = categories.find((c) => c.id === sourceId)?.name;
  const targetName = categories.find((c) => c.id === targetId)?.name;

  return (
    <div className="wizard">
      <div className="step">
        <span className="stepLabel">Merge duplicate categories</span>
        <p className="hint">
          Moves everything pointing at one category over to another, then deletes the empty one.
          Useful when free-typed names drift apart — &ldquo;Solar Light&rdquo; and &ldquo;Solar
          Lights&rdquo;. This can&apos;t be undone.
        </p>

        {done && <div className="successBanner">{done}</div>}
        {error && <div className="clientError">{error}</div>}

        <label className="stepLabel" htmlFor="mergeSource">
          Merge this one away
        </label>
        <select
          id="mergeSource"
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value ? Number(e.target.value) : "");
            setUsage(null);
          }}
        >
          <option value="">Choose a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="stepLabel" htmlFor="mergeTarget">
          Into this one (the survivor)
        </label>
        <select
          id="mergeTarget"
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value ? Number(e.target.value) : "");
            setUsage(null);
          }}
        >
          <option value="">Choose a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {sameCategory && <p className="clientError">Pick two different categories.</p>}

        {!usage && (
          <button type="button" className="submitBtn" disabled={!ready || isPending} onClick={preview}>
            {isPending ? "Checking…" : "Preview what moves"}
          </button>
        )}

        {usage && (
          <>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Column</th>
                    <th className="num">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.references.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        Nothing references this category — it&apos;s safe to merge away.
                      </td>
                    </tr>
                  )}
                  {usage.references.map((r) => (
                    <tr key={`${r.table}.${r.column}`}>
                      <td className="mono small">{r.table}</td>
                      <td className="mono small">{r.column}</td>
                      <td className="num">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              {usage.total} row{usage.total === 1 ? "" : "s"} will move from{" "}
              <strong>{sourceName}</strong> to <strong>{targetName}</strong>, then{" "}
              <strong>{sourceName}</strong> is deleted. Where a member has a consent setting on
              both, the stricter of the two is kept — a merge never widens what someone agreed to
              share.
            </p>
            <div className="actions">
              <button type="button" className="dangerBtn" disabled={isPending} onClick={confirm}>
                {isPending ? "Merging…" : `Merge and delete “${sourceName}”`}
              </button>
              <button type="button" className="cancelBtn" onClick={() => setUsage(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
