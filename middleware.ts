import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/totp", "/_next", "/favicon"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  console.log(`[Middleware] ${pathname}`);

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for admin session cookie
  const token = req.cookies.get("admin_token")?.value;

  console.log(`[Middleware] Token present: ${!!token}`);

  if (!token || token.trim() === "") {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    console.log(`[Middleware] Redirecting to login`);
    return NextResponse.redirect(loginUrl);
  }

  // Token presence is verified here; full JWT validation happens in API routes
  // Note: Full JWT validation with backend happens in API routes
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
