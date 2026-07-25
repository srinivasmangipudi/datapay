"use client";

import { useTransition, useState } from "react";
import { LANGUAGE_NAMES } from "../lib/language-names";
import { updateZoneCentroidAction, updateZoneLanguageAction } from "./actions";
import { ZoneCentroidMapModal } from "./ZoneCentroidMapModal";

export interface ZoneRow {
  id: string;
  parent_id: string | null;
  name: string;
  name_kn: string | null;
  level: string;
  centroid_lat: string | null;
  centroid_lng: string | null;
  language_code: string | null;
}

const LEVEL_INDENT: Record<string, string> = {
  constituency: "",
  hobli: "— ",
  panchayat: "—— ",
  village: "——— ",
};

export function ZonesTable({ zones }: { zones: ZoneRow[] }): JSX.Element {
  const [mapZone, setMapZone] = useState<ZoneRow | null>(null);
  const [, startTransition] = useTransition();

  function handleSave(lat: number, lng: number) {
    if (!mapZone) return;
    startTransition(() => {
      updateZoneCentroidAction(mapZone.id, { centroidLat: lat, centroidLng: lng });
    });
    setMapZone(null);
  }

  function handleLanguageChange(zoneId: string, languageCode: string) {
    if (!languageCode) return;
    startTransition(() => {
      updateZoneLanguageAction(zoneId, { languageCode });
    });
  }

  return (
    <>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Level</th>
              <th>Centroid</th>
              <th>Language</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td>
                  {LEVEL_INDENT[z.level] ?? ""}
                  {z.name}
                  {z.name_kn && <span className="muted small"> · {z.name_kn}</span>}
                </td>
                <td className="level">{z.level}</td>
                <td className="mono small">
                  {z.centroid_lat && z.centroid_lng ? (
                    `${Number(z.centroid_lat).toFixed(4)}, ${Number(z.centroid_lng).toFixed(4)}`
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="small">
                  <select
                    value={z.language_code ?? ""}
                    onChange={(e) => handleLanguageChange(z.id, e.target.value)}
                  >
                    <option value="" disabled>
                      Not set
                    </option>
                    {Object.entries(LANGUAGE_NAMES).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="actions">
                  <button type="button" className="editBtn" onClick={() => setMapZone(z)}>
                    {z.centroid_lat ? "Edit" : "Set centroid"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mapZone && (
        <ZoneCentroidMapModal
          zoneName={mapZone.name}
          initialLat={mapZone.centroid_lat ? Number(mapZone.centroid_lat) : null}
          initialLng={mapZone.centroid_lng ? Number(mapZone.centroid_lng) : null}
          onSave={handleSave}
          onClose={() => setMapZone(null)}
        />
      )}
    </>
  );
}
