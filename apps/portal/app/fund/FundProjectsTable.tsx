"use client";

import { useState, useTransition } from "react";
import { updateFundProjectAction } from "./actions";
import { FundProject } from "./core-api";

const STATUSES = ["proposed", "voting", "approved", "funded", "done"] as const;

function EditableRow({ project, onDone }: { project: FundProject; onDone: () => void }): JSX.Element {
  const [title, setTitle] = useState(project.title);
  const [titleKn, setTitleKn] = useState(project.title_kn ?? "");
  const [estimateRupees, setEstimateRupees] = useState(project.estimate_paise / 100);
  const [status, setStatus] = useState(project.status);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setClientError(null);
    if (!title.trim()) {
      setClientError("Title can't be empty.");
      return;
    }
    if (estimateRupees <= 0) {
      setClientError("Estimate must be a positive amount.");
      return;
    }
    startTransition(() => {
      updateFundProjectAction(project.id, {
        title: title.trim(),
        titleKn: titleKn.trim() || undefined,
        estimatePaise: Math.round(estimateRupees * 100),
        status,
      });
    });
  }

  return (
    <tr className="editRow">
      <td>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (English)" />
        <input
          value={titleKn}
          onChange={(e) => setTitleKn(e.target.value)}
          placeholder="Title (Kannada) — optional"
          style={{ marginTop: 6 }}
        />
        {clientError && (
          <div className="clientError" style={{ marginTop: 6 }}>
            {clientError}
          </div>
        )}
      </td>
      <td className="small">{project.zone_name}</td>
      <td>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="num">
        <input
          type="number"
          min={0}
          step="0.01"
          value={estimateRupees}
          onChange={(e) => setEstimateRupees(Number(e.target.value))}
        />
      </td>
      <td className="num">{project.yes_votes}</td>
      <td className="num">{project.no_votes}</td>
      <td className="actions">
        <button type="button" className="saveBtn" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="cancelBtn" onClick={onDone} disabled={isPending}>
          Cancel
        </button>
      </td>
    </tr>
  );
}

export function FundProjectsTable({ projects }: { projects: FundProject[] }): JSX.Element {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Zone</th>
            <th>Status</th>
            <th className="num">Estimate</th>
            <th className="num">Yes</th>
            <th className="num">No</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) =>
            editingId === p.id ? (
              <EditableRow key={p.id} project={p} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={p.id}>
                <td>
                  {p.title}
                  {p.title_kn && <div className="muted small">{p.title_kn}</div>}
                </td>
                <td className="small">{p.zone_name}</td>
                <td className="small">{p.status}</td>
                <td className="num value">₹{(p.estimate_paise / 100).toLocaleString()}</td>
                <td className="num">{p.yes_votes}</td>
                <td className="num">{p.no_votes}</td>
                <td className="actions">
                  <button type="button" className="editBtn" onClick={() => setEditingId(p.id)}>
                    Edit
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
