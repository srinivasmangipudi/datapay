"use client";

import { useState, useTransition } from "react";
import { createFundProjectAction } from "./actions";

interface Zone {
  id: string;
  name: string;
  level: string;
}

export function FundWizard({ zones }: { zones: Zone[] }): JSX.Element {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [titleKn, setTitleKn] = useState("");
  const [estimateRupees, setEstimateRupees] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!zoneId) {
      setClientError("Pick a zone.");
      return;
    }
    if (!title.trim()) {
      setClientError("The project needs a title.");
      return;
    }
    if (estimateRupees <= 0) {
      setClientError("Estimate must be a positive amount.");
      return;
    }

    startTransition(() => {
      createFundProjectAction({
        zoneId,
        title: title.trim(),
        titleKn: titleKn.trim() || undefined,
        estimatePaise: Math.round(estimateRupees * 100),
      });
    });
  }

  return (
    <form className="wizard" onSubmit={handleSubmit}>
      {clientError && <div className="clientError">{clientError}</div>}

      <div className="step">
        <span className="stepLabel">1. Zone &amp; project</span>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} ({z.level})
            </option>
          ))}
        </select>
        <input placeholder="Title (English)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Title (Kannada) — optional" value={titleKn} onChange={(e) => setTitleKn(e.target.value)} />
      </div>

      <div className="step">
        <span className="stepLabel">2. Estimate</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={estimateRupees}
          onChange={(e) => setEstimateRupees(Number(e.target.value))}
          placeholder="Estimate in ₹"
        />
      </div>

      <button type="submit" className="submitBtn" disabled={isPending}>
        {isPending ? "Creating…" : "Propose project"}
      </button>
      <p className="hint">
        Lands as 'proposed' — members in this zone vote on it via the app; nothing here approves it
        automatically.
      </p>
    </form>
  );
}
