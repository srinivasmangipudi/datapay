import { apiFetch } from "../../lib/core-api-client";

export interface OrgProduct {
  id: number;
  category_id: number | null;
  name_en: string;
  name_kn: string | null;
  description_en: string | null;
  unit_spec: string | null;
  market_price_paise: number;
  sale_price_paise: number;
  quantity_available: number;
  photo_url: string | null;
  source: "manual" | "sheet_extracted";
  review_state: "draft" | "approved" | "rejected";
  zone_id: string | null;
}

export interface ImportRun {
  id: number;
  source_url: string;
  status: "running" | "completed" | "failed";
  products_found: number;
  products_created: number;
  products_updated: number;
  error_message: string | null;
  created_at: string;
}

export interface OwnOrder {
  id: number;
  name_en: string;
  quantity: number;
  unit_price_paise: number;
  relay_token: string;
  status: string;
  created_at: string;
}

export interface CreateProductPayload {
  nameEn: string;
  nameKn?: string;
  descriptionEn?: string;
  unitSpec?: string;
  categoryId?: number;
  marketPricePaise: number;
  salePricePaise: number;
  quantityAvailable: number;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function listOwnProducts(token: string): Promise<OrgProduct[]> {
  return apiFetch("/v1/org/products", { headers: auth(token) });
}

export function createProduct(token: string, payload: CreateProductPayload): Promise<{ id: number }> {
  return apiFetch("/v1/org/products", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify(payload),
  });
}

export interface UpdateProductPayload {
  nameEn?: string;
  descriptionEn?: string;
  categoryId?: number;
  unitSpec?: string;
  marketPricePaise?: number;
  salePricePaise?: number;
  quantityAvailable?: number;
}

export function updateProduct(token: string, productId: number, payload: UpdateProductPayload): Promise<OrgProduct> {
  return apiFetch(`/v1/org/products/${productId}`, {
    method: "PATCH",
    headers: auth(token),
    body: JSON.stringify(payload),
  });
}

export function uploadProductPhoto(token: string, productId: number, imageBase64: string) {
  return apiFetch(`/v1/org/products/${productId}/photo`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ imageBase64 }),
  });
}

export function importProductsFromSheet(token: string, sheetUrl: string): Promise<{ runId: number }> {
  return apiFetch("/v1/org/products/import", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ sheetUrl }),
  });
}

export function listImportRuns(token: string): Promise<ImportRun[]> {
  return apiFetch("/v1/org/products/import-runs", { headers: auth(token) });
}

export function listOwnOrders(token: string): Promise<OwnOrder[]> {
  return apiFetch("/v1/org/products/orders", { headers: auth(token) });
}
