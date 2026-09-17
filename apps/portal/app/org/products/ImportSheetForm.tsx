"use client";

import { useState, useTransition } from "react";
import { importProductsAction } from "./actions";
import type { ImportRun } from "./core-api";

export function ImportSheetForm({ recentRuns }: { recentRuns: ImportRun[] }): JSX.Element {
  const [sheetUrl, setSheetUrl] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sheetUrl.trim()) return;
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await importProductsAction(sheetUrl.trim());
        if (result.ok) {
          setMessage({ kind: "ok", text: `Import started (run #${result.data.runId}) — refresh below to see results.` });
          setSheetUrl("");
        } else {
          setMessage({ kind: "error", text: result.message });
        }
      })();
    });
  }

  return (
    <div className="step">
      <span className="stepLabel">Import from a sheet</span>
      <p className="hint">
        Paste a public Google Sheets link ("Anyone with the link" sharing) or any plain CSV URL —
        products are extracted automatically. Re-importing the same sheet later updates existing
        products (by name) instead of creating duplicates; an already-approved product's price and
        quantity sync without needing re-review.
      </p>
      <form onSubmit={handleSubmit} className="importRow">
        <input
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
        />
        <button type="submit" className="submitBtn" disabled={isPending || !sheetUrl.trim()}>
          {isPending ? "Importing…" : "Import"}
        </button>
      </form>
      {message && (
        <div className={message.kind === "ok" ? "successBanner" : "errorBanner"}>{message.text}</div>
      )}

      {recentRuns.length > 0 && (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Sheet</th>
                <th>Status</th>
                <th>Found</th>
                <th>Created</th>
                <th>Updated</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => (
                <tr key={r.id}>
                  <td className="small mono">{r.source_url}</td>
                  <td className="small">
                    {r.status}
                    {r.error_message && <div className="muted small">{r.error_message}</div>}
                  </td>
                  <td className="num">{r.products_found}</td>
                  <td className="num">{r.products_created}</td>
                  <td className="num">{r.products_updated}</td>
                  <td className="muted small">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `.importRow { display: flex; gap: 8px; } .importRow input { flex: 1; }`,
        }}
      />
    </div>
  );
}
