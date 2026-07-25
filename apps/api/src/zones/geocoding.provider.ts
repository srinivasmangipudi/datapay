export interface GeocodedPlace {
  // Best available specific place name — village > hamlet > town > suburb,
  // whatever the provider actually returned. Never invented if none of these
  // were present.
  placeName: string | null;
  // The real administrative unit this place sits in (district/taluk-
  // equivalent — see the note on regionName() below for why this is a
  // proxy, not literally India's Assembly Constituency layer). Used to find
  // or create the correct parent zone, never a distance guess.
  regionName: string | null;
  // The actual state/UT name, straight from the geocoder — used only to
  // look up the zone's local language (SPEC.md §39's STATE_LANGUAGE map),
  // never invented if the geocoder didn't return one.
  state: string | null;
  displayName: string; // full human-readable address, for a confirmation screen
  lat: number;
  lng: number;
}

export interface GeocodingProvider {
  reverseGeocode(lat: number, lng: number): Promise<GeocodedPlace | null>;
  forwardGeocode(address: string): Promise<GeocodedPlace | null>;
}

/**
 * DEV ONLY / offline fallback — returns nothing rather than inventing a
 * place name. "Detected your location" is not a real claim until this is
 * swapped for a real provider (SPEC.md §38).
 */
export class NoopGeocodingProvider implements GeocodingProvider {
  async reverseGeocode(): Promise<GeocodedPlace | null> {
    return null;
  }
  async forwardGeocode(): Promise<GeocodedPlace | null> {
    return null;
  }
}

// The pilot's zones.level CHECK constraint has exactly one tier above
// village today ("constituency"), modeled on Karnataka's Assembly
// Constituency layer — but OSM/Nominatim doesn't carry that specific Indian
// electoral geography at all (it's Election Commission data, not a normal
// map tag). Rather than invent a fake constituency name, this uses the best
// REAL administrative unit Nominatim does return — district, falling back
// to a coarser one — as an honest proxy for "the right regional group,"
// named after something real on the map, not literally an EC constituency.
function regionName(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  return address.state_district ?? address.county ?? address.state ?? null;
}

interface NominatimAddress {
  village?: string;
  hamlet?: string;
  town?: string;
  suburb?: string;
  county?: string;
  state_district?: string;
  state?: string;
  country?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

// Free, no API key (SPEC.md §38 — picked over Google's Geocoding API to
// avoid the same billing/setup bureaucracy Bhashini was ruled out for, §9).
// Real tradeoff, stated plainly: OSM's coverage of small rural Indian
// villages can be thin — a reading might only resolve to taluk/district
// level, not the exact village. If that turns out too coarse in practice,
// this is a one-file swap (same seam as GeminiVisionProvider/GeminiAsrProvider).
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
// Nominatim's usage policy requires an identifying User-Agent and caps
// requests around 1/sec — fine for a pilot's onboarding volume, not
// something to batch or hammer.
const USER_AGENT = "DataPay-Pilot-Onboarding/1.0 (community demand-aggregation pilot)";

function bestPlaceName(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  return address.village ?? address.hamlet ?? address.town ?? address.suburb ?? null;
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  async reverseGeocode(lat: number, lng: number): Promise<GeocodedPlace | null> {
    const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const result = await this.fetchOne(url);
    if (!result) return null;
    return {
      placeName: bestPlaceName(result.address),
      regionName: regionName(result.address),
      state: result.address?.state ?? null,
      displayName: result.display_name,
      lat: Number(result.lat),
      lng: Number(result.lon),
    };
  }

  async forwardGeocode(address: string): Promise<GeocodedPlace | null> {
    const url = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(address)}&addressdetails=1&limit=1`;
    const result = await this.fetchOne(url);
    if (!result) return null;
    return {
      placeName: bestPlaceName(result.address),
      regionName: regionName(result.address),
      state: result.address?.state ?? null,
      displayName: result.display_name,
      lat: Number(result.lat),
      lng: Number(result.lon),
    };
  }

  private async fetchOne(url: string): Promise<NominatimResult | null> {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Geocoding lookup failed (${res.status})`);
    const data = (await res.json()) as NominatimResult | NominatimResult[];
    const result = Array.isArray(data) ? data[0] : data;
    return result ?? null;
  }
}
