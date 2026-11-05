import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CASHIER_SESSION_COOKIE, isValidCashierSession } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const authenticated = isValidCashierSession(request.cookies.get(CASHIER_SESSION_COOKIE)?.value);
  if (request.nextUrl.pathname === "/login") {
    return authenticated
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }
  return authenticated
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/", "/login"],
};
