import { NextResponse } from "next/server";
import {
  CASHIER_SESSION_COOKIE,
  CASHIER_SESSION_MAX_AGE,
  createCashierSession,
  isCashierAuthConfigured,
  verifyCashierCredentials,
} from "@/lib/auth";

function loginError(message: string, status: number) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return loginError("Format data tidak valid.", 400);
  }

  if (!isCashierAuthConfigured()) {
    return loginError("Login belum dikonfigurasi. Isi CASHIER_USERNAME, CASHIER_PASSWORD, dan AUTH_SECRET pada .env.local.", 503);
  }
  if (!input || typeof input !== "object") {
    return loginError("Masukkan username dan password.", 400);
  }

  const { username, password } = input as { username?: unknown; password?: unknown };
  if (typeof username !== "string" || typeof password !== "string" || username.length > 200 || password.length > 1000) {
    return loginError("Username atau password tidak tepat.", 401);
  }
  if (!verifyCashierCredentials(username, password)) {
    return loginError("Username atau password tidak tepat.", 401);
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({
    name: CASHIER_SESSION_COOKIE,
    value: createCashierSession(username),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CASHIER_SESSION_MAX_AGE,
  });
  return response;
}
