"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createProduct,
  type CreateProductPayload,
  importProductsFromSheet,
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

export async function createProductAction(
  payload: CreateProductPayload
): Promise<ActionResult<{ id: number }>> {
  try {
    const token = requireOrgToken();
    const result = await createProduct(token, payload);
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
