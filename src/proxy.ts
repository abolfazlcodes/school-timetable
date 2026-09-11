import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_SESSION_COOKIE } from "@/modules/auth/session-token";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") return NextResponse.next();
  const cookieName = process.env.SESSION_COOKIE_NAME || DEFAULT_SESSION_COOKIE;
  const token = request.cookies.get(cookieName)?.value;
  if (!token || token.length < 32 || token.length > 128) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
