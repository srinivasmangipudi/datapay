"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "portal_session";

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  const expected = process.env.PORTAL_ADMIN_PASSWORD;
  if (!expected) {
    return redirect(`/login?error=${encodeURIComponent("Portal misconfigured: missing PORTAL_ADMIN_PASSWORD")}`);
  }
  if (password !== expected) {
    return redirect(`/login?error=${encodeURIComponent("Wrong password")}&next=${encodeURIComponent(next)}`);
  }

  const sessionSecret = process.env.PORTAL_SESSION_SECRET;
  if (!sessionSecret) {
    return redirect(`/login?error=${encodeURIComponent("Portal misconfigured: missing PORTAL_SESSION_SECRET")}`);
  }

  cookies().set(SESSION_COOKIE, sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
