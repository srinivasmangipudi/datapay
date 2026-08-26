"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { orgLogin } from "../core-api";

const ORG_SESSION_COOKIE = "org_session";
const ORG_NAME_COOKIE = "org_name";

export async function orgLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/org/questions");

  let token: string;
  let name: string;
  try {
    ({ token, name } = await orgLogin(email, password));
  } catch (err) {
    redirect(
      `/org/login?error=${encodeURIComponent((err as Error).message)}&next=${encodeURIComponent(next)}`
    );
  }

  const secure = process.env.NODE_ENV === "production";
  cookies().set(ORG_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  // Display-only, not sensitive — the JWT above is the actual credential.
  cookies().set(ORG_NAME_COOKIE, name, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next.startsWith("/org") ? next : "/org/questions");
}

export async function orgLogoutAction(): Promise<void> {
  cookies().delete(ORG_SESSION_COOKIE);
  cookies().delete(ORG_NAME_COOKIE);
  redirect("/org/login");
}
