import { NextRequest, NextResponse } from "next/server";

const publicApiRoutes = new Set([
  "/api/firebase-health",
  "/api/health",
  "/api/firebase-auth",
  "/api/payments/webhook",
  "/api/ppdb",
  "/api/ppdb/documents",
  "/api/wali-auth",
  "/api/wali-register",
  "/api/wali-pin-reset",
]);

function hasSession(request: NextRequest) {
  return Boolean(
    request.cookies.get("sinurman_admin_session")?.value ||
      request.cookies.get("sinurman_wali_session")?.value ||
      request.headers.get("oai-authenticated-user-email"),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const logoRead = pathname === "/api/branding/logo" && request.method === "GET";
  if (publicApiRoutes.has(pathname) || logoRead || hasSession(request)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    { error: "Silakan masuk untuk membuka SINURMAN." },
    { status: 401 },
  );
}

export const config = {
  matcher: "/api/:path*",
};
