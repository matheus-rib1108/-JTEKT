import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/server/db/client";
import { passwordResetConfirmSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/server/auth/password";
import { revokeAllSessionsForUser } from "@/server/auth/session";
import { clearFailedLogins } from "@/server/auth/rateLimit";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = passwordResetConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { token, password } = parsed.data;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  const isValid =
    !!resetToken && !resetToken.usedAt && resetToken.expiresAt.getTime() > Date.now();

  if (!isValid) {
    return NextResponse.json(
      { error: "Link de redefinição inválido ou expirado." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken!.userId },
      data: { passwordHash, status: "ACTIVE" },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken!.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await revokeAllSessionsForUser(resetToken!.userId);
  await clearFailedLogins(resetToken!.userId);

  await writeAuditLog({
    tenantId: resetToken!.user.tenantId,
    actorUserId: resetToken!.userId,
    action: "user.password_reset_completed",
    entityType: "User",
    entityId: resetToken!.userId,
    ipAddress: getRequestIp(request),
  });

  return NextResponse.json({ message: "Senha redefinida com sucesso. Faça login novamente." });
}
