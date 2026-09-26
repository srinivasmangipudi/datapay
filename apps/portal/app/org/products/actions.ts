"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveCategory } from "../core-api";
import {
  createProduct,
  type CreateProductPayload,
  importProductsFromSheet,
  type OrgProduct,
  updateProduct,
  type UpdateProductPayload,
  uploadProductPhoto,
} from "./core-api";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

function requireOrgToken(): string {
  const token = cookies().get("org_session")?.value;
  if (!token) throw new Error("Not logged in");
  return token;
}

export async function importProductsAction(sheetUrl: string): Promise<ActionResult<{ runId: number }>> {
  try {
    const token = requireOrgToken();
    const result = await importProductsFromSheet(token, sheetUrl);
    revalidatePath("/org/products");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/**
 * The form sends a category NAME (typed or picked from the datalist), not an
 * id — resolving it here rather than in the client keeps the org token on the
 * server and lets an unrecognised name create the category in the same pass.
 */
async function resolveCategoryId(
  token: string,
  categoryName: string | undefined
): Promise<number | undefined> {
  const name = categoryName?.trim();
  if (!name) return undefined;
  const { id } = await resolveCategory(token, name);
  return id;
}

export async function createProductAction(
  payload: CreateProductPayload & { categoryName?: string }
): Promise<ActionResult<{ id: number }>> {
  try {
    const token = requireOrgToken();
    const { categoryName, ...rest } = payload;
    const categoryId = await resolveCategoryId(token, categoryName);
    const result = await createProduct(token, { ...rest, categoryId });
    revalidatePath("/org/products");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function updateProductAction(
  productId: number,
  payload: UpdateProductPayload & { categoryName?: string }
): Promise<ActionResult<OrgProduct>> {
  try {
    const token = requireOrgToken();
    const { categoryName, ...rest } = payload;
    const categoryId = await resolveCategoryId(token, categoryName);
    const result = await updateProduct(token, productId, { ...rest, categoryId });
    revalidatePath("/org/products");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function uploadPhotoAction(
  productId: number,
  imageBase64: string
): Promise<ActionResult<{ photoUrl: string }>> {
  try {
    const token = requireOrgToken();
    const result = await uploadProductPhoto(token, productId, imageBase64);
    revalidatePath("/org/products");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
