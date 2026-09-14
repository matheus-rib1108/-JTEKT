import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/server/auth/password";
import { attachSessionCookies, createSession } from "@/server/auth/session";
import {
  clearFailedLogins,
  isAccountLocked,
  isLoginRateLimited,
  recordLoginAttempt,
  registerFailedLogin,
} from "@/server/auth/rateLimit";
import { getRequestIp } from "@/server/http/ip";
import { writeAuditLog } from "@/server/audit/log";

const GENERIC_INVALID_CREDENTIALS = {
  error: "Credenciais inválidas.",
} as const;

export async function POST(request: Request) {
  const ip = getRequestIp(request);

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  if (await isLoginRateLimited(email, ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  // Email is unique per tenant, not globally — this looks up the first
  // match, which is correct while the platform serves a single tenant.
  // Multi-tenant login (§37) will need tenant-aware resolution (subdomain
  // or an explicit company selector) before a second tenant goes live.
  const user = await prisma.user.findFirst({
    where: { email },
    include: { role: true },
  });

  if (!user) {
    await recordLoginAttempt(email, false, ip);
    return NextResponse.json(GENERIC_INVALID_CREDENTIALS, { status: 401 });
  }

  if (isAccountLocked(user.lockedUntil)) {
    return NextResponse.json(
      { error: "Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde." },
      { status: 423 },
    );
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    await registerFailedLogin(user.id);
    await recordLoginAttempt(email, false, ip);
    return NextResponse.json(GENERIC_INVALID_CREDENTIALS, { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Esta conta não está ativa." }, { status: 403 });
  }

  await clearFailedLogins(user.id);
  await recordLoginAttempt(email, true, ip);

  const { rawToken, expiresAt } = await createSession({
    userId: user.id,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  const cookieStore = await cookies();
  attachSessionCookies(cookieStore, rawToken, expiresAt);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip ?? undefined },
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "user.login",
    entityType: "User",
    entityId: user.id,
    ipAddress: ip,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      roleKey: user.role.key,
    },
  });
}
