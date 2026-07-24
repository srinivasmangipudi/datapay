"use client";

import { useState, useTransition } from "react";
import { createZoneAction } from "./actions";

interface Zone {
  id: string;
  name: string;
  level: string;
}

const LEVELS = ["village", "panchayat", "hobli", "constituency"] as const;

export function ZoneWizard({ zones }: { zones: Zone[] }): JSX.Element {
  const [name, setName] = useState("");
  const [nameKn, setNameKn] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("village");
  const [parentId, setParentId] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    if (!name.trim()) {
      setClientError("The zone needs a name.");
      return;
    }
    startTransition(() => {
      createZoneAction({
        name: name.trim(),
        nameKn: nameKn.trim() || undefined,
        level,
        parentId: parentId || undefined,
      });
    });
  }

  return (
    <form className="wizard" onSubmit={handleSubmit}>
      {clientError && <div className="clientError">{clientError}</div>}
      <div className="step">
        <span className="stepLabel">New zone</span>
        <input placeholder="Name (English)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Name (Kannada) — optional" value={nameKn} onChange={(e) => setNameKn(e.target.value)} />
        <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">No parent (top-level constituency)</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} ({z.level})
            </option>
          ))}
        </select>
        <button type="submit" className="submitBtn" disabled={isPending}>
          {isPending ? "Creating…" : "Create zone"}
        </button>
      </div>
    </form>
  );
}
