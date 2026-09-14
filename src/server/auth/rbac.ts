import "server-only";
import { cookies } from "next/headers";
import { getSessionByRawToken, SESSION_COOKIE_NAME } from "@/server/auth/session";
import type { PermissionKey } from "@/lib/permissions";

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  userType: "INTERNAL" | "CLIENT";
  customerCompanyId: string | null;
  roleKey: string;
  permissions: Set<PermissionKey>;
}

/**
 * Resolves the current request's user from the session cookie. Returns null
 * for anonymous requests — callers must decide whether that is allowed.
 * This is the ONLY function server code should trust for identity; never
 * infer the user from a client-supplied field.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const session = await getSessionByRawToken(rawToken);
  if (!session) return null;

  const permissions = new Set(
    session.user.role.permissions.map((rp) => rp.permission.key as PermissionKey),
  );

  return {
    id: session.user.id,
    tenantId: session.user.tenantId,
    name: session.user.name,
    email: session.user.email,
    userType: session.user.userType,
    customerCompanyId: session.user.customerCompanyId,
    roleKey: session.user.role.key,
    permissions,
  };
}

export function hasPermission(user: AuthenticatedUser, permission: PermissionKey): boolean {
  return user.permissions.has(permission);
}

/** Throws-free guard for use in Server Components/route handlers: returns
 * the user only if authenticated AND authorized, otherwise null so callers
 * render the appropriate 401/403 state instead of leaking data. */
export async function requirePermission(
  permission: PermissionKey,
): Promise<{ user: AuthenticatedUser } | { user: null; reason: "unauthenticated" | "forbidden" }> {
  const user = await getCurrentUser();
  if (!user) return { user: null, reason: "unauthenticated" };
  if (!hasPermission(user, permission)) return { user: null, reason: "forbidden" };
  return { user };
}
