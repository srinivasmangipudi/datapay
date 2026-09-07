"use client";

import { useMemo, useState } from "react";
import { ZONE_LEVELS, type ZoneLevel } from "@datapay/shared";
import { ZoneCentroidMapModal } from "../zones/ZoneCentroidMapModal";
import { createZoneAction } from "./actions";

export interface Zone {
  id: string;
  parentId: string | null;
  name: string;
  nameKn: string | null;
  level: ZoneLevel;
}

const LEVEL_ORDER: ZoneLevel[] = ["constituency", "hobli", "panchayat", "village"];
const LEVEL_LABEL: Record<ZoneLevel, string> = {
  constituency: "constituency",
  hobli: "hobli",
  panchayat: "panchayat",
  village: "village",
};

export function PlaceStep({
  zones,
  onSelected,
}: {
  zones: Zone[];
  onSelected: (zoneId: string | null, zoneName: string) => void;
}): JSX.Element {
  const [mode, setMode] = useState<"browse" | "new">("browse");
  const [path, setPath] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");

  const currentParentId = path.length > 0 ? path[path.length - 1].id : null;
  const currentLevel = LEVEL_ORDER[path.length];
  const options = zones.filter((z) => z.parentId === currentParentId && z.level === currentLevel);
  const currentParent = path.length > 0 ? path[path.length - 1] : null;

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return zones.filter((z) => z.name.toLowerCase().includes(q) || z.nameKn?.toLowerCase().includes(q)).slice(0, 8);
  }, [search, zones]);

  function selectZone(zone: Zone) {
    if (zone.level === "village") {
      onSelected(zone.id, zone.name);
      return;
    }
    setPath([...path, zone]);
    setSearch("");
  }

  return (
    <div className="step">
      <span className="stepLabel">1. Where is this question for?</span>

      <div className="typeGrid" style={{ marginBottom: 16 }}>
        <label className={`typeCard ${mode === "browse" ? "typeCardOn" : ""}`}>
          <input type="radio" checked={mode === "browse"} onChange={() => setMode("browse")} />
          <span className="typeCardLabel">Browse existing places</span>
          <span className="typeCardHint">Pick a place you've already onboarded, or go global.</span>
        </label>
        <label className={`typeCard ${mode === "new" ? "typeCardOn" : ""}`}>
          <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
          <span className="typeCardLabel">Add a new place on the map</span>
          <span className="typeCardHint">Not onboarded yet — drop a pin and name it.</span>
        </label>
      </div>

      {mode === "browse" && (
        <>
          <button type="button" className="submitBtn" style={{ marginBottom: 16 }} onClick={() => onSelected(null, "Global")}>
            Global — every member, everywhere →
          </button>

          <input
            placeholder="Search places by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim() && (
            <div className="placeList">
              {searchResults.length === 0 && <p className="empty">No places match "{search}".</p>}
              {searchResults.map((z) => (
                <button key={z.id} type="button" className="placeRow" onClick={() => onSelected(z.id, z.name)}>
                  <span>{z.name}</span>
                  <span className="muted small">{LEVEL_LABEL[z.level]}</span>
                </button>
              ))}
            </div>
          )}

          {!search.trim() && (
            <>
              {path.length > 0 && (
                <div className="breadcrumb">
                  {path.map((z, i) => (
                    <span key={z.id}>
                      {i > 0 && " › "}
                      {z.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="hint" style={{ marginTop: path.length > 0 ? 8 : 16 }}>
                {LEVEL_LABEL[currentLevel]}
              </p>
              <div className="placeList">
                {options.length === 0 && (
                  <p className="empty">Nothing more specific listed here yet.</p>
                )}
                {options.map((z) => (
                  <button key={z.id} type="button" className="placeRow" onClick={() => selectZone(z)}>
                    <span>{z.name}</span>
                    <span className="muted small">{z.level === "village" ? "select →" : "drill in →"}</span>
                  </button>
                ))}
              </div>
              <div className="placeActions">
                {path.length > 0 && (
                  <button type="button" className="linkBtn" onClick={() => setPath(path.slice(0, -1))}>
                    ← Back
                  </button>
                )}
                {currentParent && (
                  <button
                    type="button"
                    className="linkBtn"
                    onClick={() => onSelected(currentParent.id, currentParent.name)}
                  >
                    Use {currentParent.name} for this question →
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {mode === "new" && <NewPlaceForm zones={zones} onSelected={onSelected} />}
    </div>
  );
}

function NewPlaceForm({
  zones,
  onSelected,
}: {
  zones: Zone[];
  onSelected: (zoneId: string, zoneName: string) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [nameKn, setNameKn] = useState("");
  const [level, setLevel] = useState<ZoneLevel>("village");
  const [parentId, setParentId] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Only the level directly above may be a parent — a real constraint the
  // older ZoneWizard doesn't have (it allows any zone as parent of any zone).
  const parentLevelIndex = ZONE_LEVELS.indexOf(level) + 1;
  const validParents = parentLevelIndex < ZONE_LEVELS.length ? zones.filter((z) => z.level === ZONE_LEVELS[parentLevelIndex]) : [];

  async function handleCreate() {
    if (!name.trim()) {
      setError("Give the place a name.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const result = await createZoneAction({
        name: name.trim(),
        nameKn: nameKn.trim() || undefined,
        level,
        parentId: parentId || undefined,
        centroidLat: lat ?? undefined,
        centroidLng: lng ?? undefined,
      });
      if (!result.ok || !result.data) {
        setError(result.message ?? "Couldn't create that place.");
        return;
      }
      onSelected(result.data.id, name.trim());
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {error && <div className="clientError">{error}</div>}
      <input placeholder="Place name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Kannada name — optional" value={nameKn} onChange={(e) => setNameKn(e.target.value)} />
      <div className="typeGrid">
        {ZONE_LEVELS.map((l) => (
          <label key={l} className={`typeCard ${level === l ? "typeCardOn" : ""}`}>
            <input
              type="radio"
              checked={level === l}
              onChange={() => {
                setLevel(l);
                setParentId("");
              }}
            />
            <span className="typeCardLabel">{LEVEL_LABEL[l]}</span>
          </label>
        ))}
      </div>
      {validParents.length > 0 && (
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— pick a parent {LEVEL_LABEL[ZONE_LEVELS[parentLevelIndex]]} —</option>
          {validParents.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      )}
      <button type="button" className="linkBtn" onClick={() => setShowMap(true)}>
        {lat !== null ? `Location set: ${lat.toFixed(5)}, ${lng!.toFixed(5)} — change` : "Drop a pin on the map — optional →"}
      </button>
      {showMap && (
        <ZoneCentroidMapModal
          zoneName={name.trim() || "New place"}
          initialLat={lat}
          initialLng={lng}
          onSave={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}
      <button type="button" className="submitBtn" style={{ marginTop: 16 }} onClick={handleCreate} disabled={creating}>
        {creating ? "Creating…" : "Create place and continue →"}
      </button>
    </div>
  );
}
