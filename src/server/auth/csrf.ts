import "server-only";
import { CSRF_COOKIE_NAME } from "@/lib/auth-constants";

export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Double-submit CSRF check for state-changing requests made from an
 * authenticated session cookie. The CSRF cookie is not httpOnly so the
 * client can read it and echo it back in a custom header; a cross-site
 * request cannot read the cookie to forge that header.
 */
export function verifyCsrfToken(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieToken = parseCookie(cookieHeader, CSRF_COOKIE_NAME);
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) return false;
  return timingSafeEqual(cookieToken, headerToken);
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
