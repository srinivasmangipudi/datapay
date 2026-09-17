// Genuinely public — no org_session, no portal_session, mirrors /registry's
// posture of hitting an unauthenticated Core API endpoint directly.
import { apiFetch } from "../../lib/core-api-client";

export interface StoreProduct {
  id: number;
  nameEn: string;
  nameKn: string | null;
  descriptionEn: string | null;
  unitSpec: string | null;
  marketPricePaise: number;
  salePricePaise: number;
  quantityAvailable: number;
  photoUrl: string | null;
  categoryName: string | null;
}

export interface StoreCatalog {
  organization: { name: string; slug: string };
  products: StoreProduct[];
}

export async function getStoreCatalog(slug: string): Promise<StoreCatalog | null> {
  try {
    return await apiFetch(`/v1/public/organizations/${encodeURIComponent(slug)}`);
  } catch (err) {
    if ((err as Error).message.includes("not found")) return null;
    throw err;
  }
}
