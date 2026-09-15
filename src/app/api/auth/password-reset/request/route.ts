import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/server/db/client";
import { passwordResetRequestSchema } from "@/lib/validation/auth";
import { getRequestIp } from "@/server/http/ip";
import { isLoginRateLimited, recordLoginAttempt } from "@/server/auth/rateLimit";
import { sendPasswordResetEmail } from "@/server/notifications/email";
import { writeAuditLog } from "@/server/audit/log";
import { getAppUrl } from "@/server/config/appUrl";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const GENERIC_RESPONSE = {
  message: "Se o e-mail informado estiver cadastrado, enviaremos instruções de redefinição.",
} as const;

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const body = await request.json().catch(() => null);
  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email } = parsed.data;

  // Reuses the login throttle table under a distinct identifier namespace
  // so password-reset spam cannot be used to bypass login rate limiting
  // (or vice-versa).
  if (await isLoginRateLimited(`pwreset:${email}`, ip)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }
  await recordLoginAttempt(`pwreset:${email}`, false, ip);

  const user = await prisma.user.findFirst({ where: { email } });

  // Always respond identically whether or not the account exists, to avoid
  // leaking which e-mails are registered.
  if (!user) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const rawToken = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const appUrl = getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "user.password_reset_requested",
    entityType: "User",
    entityId: user.id,
    ipAddress: ip,
  });

  return NextResponse.json(GENERIC_RESPONSE);
}
