"use client";

import { useState, useTransition } from "react";
import { LANGUAGE_NAMES } from "../lib/language-names";
import { createZoneAction } from "./actions";
import { ZoneCentroidMapModal } from "./ZoneCentroidMapModal";

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
  const [centroidLat, setCentroidLat] = useState<number | null>(null);
  const [centroidLng, setCentroidLng] = useState<number | null>(null);
  const [languageCode, setLanguageCode] = useState("");
  const [showMap, setShowMap] = useState(false);
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
        centroidLat: centroidLat ?? undefined,
        centroidLng: centroidLng ?? undefined,
        languageCode: languageCode || undefined,
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
        <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
          <option value="">Local language — not set (leave for geocoding/ops to set later)</option>
          {Object.entries(LANGUAGE_NAMES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="linkBtn" onClick={() => setShowMap(true)}>
          {centroidLat !== null ? "Change centroid on map →" : "Set centroid on map — optional →"}
        </button>
        {centroidLat !== null && centroidLng !== null && (
          <p className="hint mono">
            {centroidLat.toFixed(5)}, {centroidLng.toFixed(5)}
          </p>
        )}
        <p className="hint">
          A representative point (e.g. the town center) — used only to match a member's phone GPS to
          the nearest zone (SPEC.md §35), not a real boundary. Leave blank if unknown; it can be set
          later.
        </p>
        <button type="submit" className="submitBtn" disabled={isPending}>
          {isPending ? "Creating…" : "Create zone"}
        </button>
      </div>

      {showMap && (
        <ZoneCentroidMapModal
          zoneName={name.trim() || "new zone"}
          initialLat={centroidLat}
          initialLng={centroidLng}
          onSave={(lat, lng) => {
            setCentroidLat(lat);
            setCentroidLng(lng);
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </form>
  );
}
