/**
 * Cookie name constants shared between the Node-only session module
 * (src/server/auth/session.ts) and the Edge middleware (src/middleware.ts).
 * Kept dependency-free (no "server-only", no Node builtins) so middleware
 * can import it without pulling `crypto`/Prisma into the Edge bundle.
 */
export const SESSION_COOKIE_NAME = "sf_session";
export const CSRF_COOKIE_NAME = "sf_csrf";
