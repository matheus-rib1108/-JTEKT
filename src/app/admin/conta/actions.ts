"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/rbac";
import { generateMfaEnrollment, verifyEnrollmentCode, verifyTotpCode, encryptSecretForStorage } from "@/server/auth/mfa";
import { confirmMfaEnrollmentSchema, disableMfaSchema } from "@/lib/validation/mfa";
import { isLoginRateLimited, recordLoginAttempt } from "@/server/auth/rateLimit";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";

type ActionResult = { ok: true } | { ok: false; error: string };
type EnrollmentResult = { ok: true; secretBase32: string; qrCodeDataUrl: string; manualEntryKey: string } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

/** Any authenticated internal user manages their own MFA — this is
 * self-service, not gated by a permission beyond "is logged in". */
export async function startMfaEnrollment(): Promise<EnrollmentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  const enrollment = await generateMfaEnrollment(user.email);
  return { ok: true, ...enrollment };
}

export async function confirmMfaEnrollment(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  const parsed = confirmMfaEnrollmentSchema.safeParse({
    secretBase32: formData.get("secretBase32"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const identifier = `mfa-enroll:${user.id}`;
  if (await isLoginRateLimited(identifier, null)) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e gere um novo QR code." };
  }

  const valid = verifyEnrollmentCode(parsed.data.secretBase32, parsed.data.code, user.email);
  await recordLoginAttempt(identifier, valid, null);
  if (!valid) return { ok: false, error: "Código inválido. Verifique o horário do seu telefone e tente novamente." };

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true, mfaSecret: encryptSecretForStorage(parsed.data.secretBase32) },
  });

  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "user.mfa_enable",
    entityType: "User",
    entityId: user.id,
    ipAddress: await ipFromHeaders(),
  });

  revalidatePath("/admin/conta");
  return { ok: true };
}

export async function disableMfa(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  const current = await prisma.user.findUnique({ where: { id: user.id } });
  if (!current?.mfaEnabled || !current.mfaSecret) return { ok: false, error: "A autenticação em duas etapas já está desativada." };

  const parsed = disableMfaSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const identifier = `mfa-disable:${user.id}`;
  if (await isLoginRateLimited(identifier, null)) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  }

  const valid = verifyTotpCode(current.mfaSecret, parsed.data.code, user.email);
  await recordLoginAttempt(identifier, valid, null);
  if (!valid) return { ok: false, error: "Código inválido." };

  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });

  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "user.mfa_disable",
    entityType: "User",
    entityId: user.id,
    ipAddress: await ipFromHeaders(),
  });

  revalidatePath("/admin/conta");
  return { ok: true };
}
