"use client";

/** Reads the (non-httpOnly, by design) CSRF cookie so it can be echoed back
 * in a request header — see src/server/auth/csrf.ts for the server side of
 * this double-submit check. */
export function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)sf_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
