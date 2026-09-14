import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/auth/rbac";
import { clearSessionCookies, revokeSessionByRawToken, SESSION_COOKIE_NAME } from "@/server/auth/session";
import { verifyCsrfToken } from "@/server/auth/csrf";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";

export async function POST(request: Request) {
  if (!verifyCsrfToken(request)) {
    return NextResponse.json({ error: "Token CSRF inválido." }, { status: 403 });
  }

  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    await revokeSessionByRawToken(rawToken);
  }
  clearSessionCookies(cookieStore);

  if (user) {
    await writeAuditLog({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "user.logout",
      entityType: "User",
      entityId: user.id,
      ipAddress: getRequestIp(request),
    });
  }

  return NextResponse.json({ ok: true });
}
