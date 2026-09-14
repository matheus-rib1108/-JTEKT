import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const PROTECTED_PREFIXES = ["/admin", "/portal"];

/**
 * Proxy (formerly "middleware") only performs a cheap "is there a session
 * cookie" gate — it runs on the Edge runtime and must not touch Postgres.
 * The authoritative authentication + RBAC check happens server-side in each
 * protected layout/page via getCurrentUser()/requirePermission(), which do
 * hit the database. Never treat this redirect as the security boundary.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.cookies.get(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

/**
 * `script-src` allows 'unsafe-inline' rather than a per-request nonce.
 * Next's nonce-based CSP (its own documented pattern) requires forcing
 * *every* route into dynamic rendering — killing static optimization
 * app-wide — because a statically prerendered page's inline scripts are
 * baked in at build time and can never match a fresh per-request nonce.
 * We don't use dangerouslySetInnerHTML anywhere (React escapes all output
 * by default), so the residual risk this trades away is narrow; revisit if
 * a future phase introduces raw HTML rendering.
 */
function applySecurityHeaders(response: NextResponse) {
  const isDev = process.env.NODE_ENV === "development";

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // 'unsafe-eval' only in dev: React's error-overlay stack reconstruction
      // needs it; Next.js/React never call eval() in production.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
