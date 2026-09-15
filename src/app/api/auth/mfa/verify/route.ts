import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";
import { mfaChallengeSchema } from "@/lib/validation/mfa";
import { verifyTotpCode } from "@/server/auth/mfa";
import { findMfaChallenge, deleteMfaChallenge } from "@/server/auth/mfaChallenge";
import { attachSessionCookies, createSession } from "@/server/auth/session";
import { isLoginRateLimited, recordLoginAttempt } from "@/server/auth/rateLimit";
import { getRequestIp } from "@/server/http/ip";
import { writeAuditLog } from "@/server/audit/log";

export async function POST(request: Request) {
  const ip = getRequestIp(request);

  const body = await request.json().catch(() => null);
  const parsed = mfaChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { challengeToken, code } = parsed.data;

  const challenge = await findMfaChallenge(challengeToken);
  if (!challenge) {
    return NextResponse.json(
      { error: "Sessão de verificação expirada. Faça login novamente." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: challenge.userId }, include: { role: true } });
  if (!user || !user.mfaEnabled || !user.mfaSecret || user.status !== "ACTIVE") {
    await deleteMfaChallenge(challenge.id);
    return NextResponse.json({ error: "Não foi possível concluir o login." }, { status: 401 });
  }

  const identifier = `mfa-login:${user.id}`;
  if (await isLoginRateLimited(identifier, ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Faça login novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const valid = verifyTotpCode(user.mfaSecret, code, user.email);
  await recordLoginAttempt(identifier, valid, ip);
  if (!valid) {
    return NextResponse.json({ error: "Código inválido." }, { status: 401 });
  }

  // Challenge is single-use regardless of outcome beyond this point —
  // a correct code consumes it immediately so it cannot be replayed.
  await deleteMfaChallenge(challenge.id);

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
