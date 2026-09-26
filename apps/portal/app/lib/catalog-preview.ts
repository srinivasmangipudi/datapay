import { apiFetch } from "./core-api-client";

export interface PreviewProduct {
  id: number;
  nameEn: string;
  salePricePaise: number;
  marketPricePaise: number;
  photoUrl: string | null;
  categoryName: string | null;
}

export interface CatalogPreview {
  orgName: string;
  orgSlug: string;
  products: PreviewProduct[];
}

/**
 * The marketing page shows a real, live organization catalog rather than
 * stock photography — the products below are the same rows a member sees.
 * Returns null on any failure (or if nothing has a photo yet) so the caller
 * can simply drop the section instead of rendering a broken shelf.
 */
export async function getCatalogPreview(slug: string, limit = 4): Promise<CatalogPreview | null> {
  try {
    const data = await apiFetch(`/v1/public/organizations/${encodeURIComponent(slug)}`);
    const products: PreviewProduct[] = (data?.products ?? [])
      .filter((p: PreviewProduct) => p.photoUrl)
      .slice(0, limit);
    if (products.length === 0) return null;
    return { orgName: data.organization.name, orgSlug: data.organization.slug, products };
  } catch {
    return null;
  }
}
