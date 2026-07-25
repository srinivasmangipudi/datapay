"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

// Melukote, Mandya district — the pilot's actual area. Only used if the
// zone has no existing centroid AND the browser can't/won't share the
// admin's location — never presented as anything other than a starting point.
const FALLBACK_LAT = 12.6889;
const FALLBACK_LNG = 76.6602;
const DEFAULT_ZOOM = 14;
const NO_LOCATION_ZOOM = 6;

interface Props {
  zoneName: string;
  initialLat: number | null;
  initialLng: number | null;
  // Fire-and-forget, same as every other action-triggering button in this
  // portal (e.g. FundProjectsTable) — the caller wraps its own server action
  // in startTransition and redirects on both success AND failure, so there's
  // never a promise here to await or an error here to catch.
  onSave: (lat: number, lng: number) => void;
  onClose: () => void;
}

export function ZoneCentroidMapModal({ zoneName, initialLat, initialLng, onSave, onClose }: Props): JSX.Element {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    initialLat !== null && initialLng !== null ? { lat: initialLat, lng: initialLng } : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Leaflet's default marker images reference relative paths that break
      // under Next.js's bundler — pointing at the same CDN the package
      // itself publishes to is the standard workaround, not a hack specific
      // to this app.
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const hasExisting = initialLat !== null && initialLng !== null;
      const startCenter: [number, number] = hasExisting
        ? [initialLat, initialLng]
        : [FALLBACK_LAT, FALLBACK_LNG];

      const map = L.map(containerRef.current).setView(startCenter, hasExisting ? DEFAULT_ZOOM : NO_LOCATION_ZOOM);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      function placeMarker(lat: number, lng: number) {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map!);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLatLng();
            setPicked({ lat: pos.lat, lng: pos.lng });
          });
        }
        setPicked({ lat, lng });
      }

      if (hasExisting) {
        placeMarker(initialLat, initialLng);
      }

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        placeMarker(e.latlng.lat, e.latlng.lng);
      });

      // No existing centroid — open centered on the admin's own location if
      // they'll share it ("opens at your location"), rather than leaving
      // them to pan/zoom to find themselves on a map of the whole country.
      if (!hasExisting && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || !mapRef.current) return;
            mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM);
          },
          () => {
            // Denied or unavailable — the fallback view set above stands; no error shown,
            // since not sharing location is a completely normal choice, not a failure.
          },
          { timeout: 8000 }
        );
      }
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave() {
    if (!picked) {
      setError("Tap the map to drop a marker first.");
      return;
    }
    onSave(picked.lat, picked.lng);
  }

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>Set centroid — {zoneName}</h3>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="hint" style={{ margin: "0 0 12px" }}>
          Tap anywhere on the map to drop a marker, or drag it once placed. This is only a
          representative point (SPEC.md §35) — not a real boundary.
        </p>
        <div ref={containerRef} className="mapContainer" />
        <div className="modalFooter">
          <span className="mono small muted">
            {picked ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : "No marker placed yet"}
          </span>
          <div className="actions">
            {error && <span className="clientError">{error}</span>}
            <button type="button" className="cancelBtn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="saveBtn" onClick={handleSave} disabled={!picked}>
              Save location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
