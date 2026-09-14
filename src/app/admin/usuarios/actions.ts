"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { sendPasswordResetEmail } from "@/server/notifications/email";

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email(),
  roleId: z.string().min(1),
});

type ActionResult = { ok: true } | { ok: false; error: string };

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Creates an internal employee account in INVITED status with an unusable
 * placeholder password hash, then issues a set-password link reusing the
 * password-reset token flow (same table, same confirm endpoint) — the user
 * activates their own account instead of an admin choosing a password. */
export async function inviteEmployee(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, isClientRole: false },
  });
  if (!role) return { ok: false, error: "Função inválida." };

  const existing = await prisma.user.findFirst({
    where: { tenantId: auth.user.tenantId, email: parsed.data.email },
  });
  if (existing) return { ok: false, error: "Já existe uma conta com este e-mail." };

  const unusablePasswordHash = crypto.randomBytes(32).toString("hex");

  const newUser = await prisma.user.create({
    data: {
      tenantId: auth.user.tenantId,
      userType: "INTERNAL",
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: unusablePasswordHash,
      roleId: role.id,
      status: "INVITED",
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: newUser.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendPasswordResetEmail(newUser.email, `${appUrl}/reset-password?token=${rawToken}`);

  const headerList = await headers();
  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "user.invite",
    entityType: "User",
    entityId: newUser.id,
    ipAddress: getRequestIp(new Request("http://localhost", { headers: headerList })),
    afterData: { email: newUser.email, roleKey: role.key },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
