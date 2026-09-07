"use client";

import { useEffect, useState } from "react";
import { getZoneUnderstandingAction, ingestZoneLinkAction } from "./actions";
import type { ZoneUnderstandingStatus } from "./core-api";

export function IntelligenceStep({
  zoneId,
  zoneName,
  onDone,
}: {
  zoneId: string;
  zoneName: string;
  onDone: (hasUnderstanding: boolean) => void;
}): JSX.Element {
  const [status, setStatus] = useState<ZoneUnderstandingStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [linkUrl, setLinkUrl] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChecking(true);
    getZoneUnderstandingAction(zoneId)
      .then(setStatus)
      .finally(() => setChecking(false));
  }, [zoneId]);

  async function handleIngest() {
    if (!linkUrl.trim()) return;
    setError(null);
    setIngesting(true);
    try {
      const result = await ingestZoneLinkAction(zoneId, linkUrl.trim());
      if (!result.ok) {
        setError(result.message ?? "Couldn't read that link.");
        return;
      }
      setStatus(result.data ?? null);
      setLinkUrl("");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="step">
      <span className="stepLabel">2. What do we know about {zoneName}?</span>

      {checking && <p className="hint">Checking what's already known…</p>}

      {!checking && status?.summaryEn && (
        <div className="understanding">
          <p className="summary">{status.summaryEn}</p>
          <p className="hint" style={{ margin: 0 }}>
            Generated {status.generatedAt ? new Date(status.generatedAt).toLocaleString() : ""}
          </p>
        </div>
      )}

      {!checking && !status?.summaryEn && (
        <p className="empty">Nothing ingested for this place yet — paste a link below, or skip.</p>
      )}

      {error && <div className="clientError">{error}</div>}

      <div className="optionRow">
        <input
          placeholder="https://… an article, report, or page about this area"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
        <button type="button" className="linkBtn" onClick={handleIngest} disabled={ingesting || !linkUrl.trim()}>
          {ingesting ? "Reading & summarizing…" : "Ingest this link"}
        </button>
      </div>

      <button type="button" className="submitBtn" style={{ marginTop: 16 }} onClick={() => onDone(Boolean(status?.summaryEn))}>
        {status?.summaryEn ? "Continue →" : "Skip — I'll write this one myself →"}
      </button>
    </div>
  );
}
