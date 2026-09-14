"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS, ROLES } from "@/lib/permissions";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { sendPasswordResetEmail } from "@/server/notifications/email";

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** A CLIENT_ADMIN can invite additional users into their own company only —
 * never into another customer's company, and never with an internal role. */
export async function inviteClientUser(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_COMPANY_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const existing = await prisma.user.findFirst({
    where: { tenantId: auth.user.tenantId, email: parsed.data.email },
  });
  if (existing) return { ok: false, error: "Já existe uma conta com este e-mail." };

  const clientUserRole = await prisma.role.findUnique({ where: { key: ROLES.CLIENT_USER } });
  if (!clientUserRole) return { ok: false, error: "Função indisponível." };

  const unusablePasswordHash = crypto.randomBytes(32).toString("hex");

  const newUser = await prisma.user.create({
    data: {
      tenantId: auth.user.tenantId,
      userType: "CLIENT",
      customerCompanyId: auth.user.customerCompanyId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: unusablePasswordHash,
      roleId: clientUserRole.id,
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
    action: "client_user.invite",
    entityType: "User",
    entityId: newUser.id,
    ipAddress: getRequestIp(new Request("http://localhost", { headers: headerList })),
    afterData: { email: newUser.email, customerCompanyId: auth.user.customerCompanyId },
  });

  revalidatePath("/portal/conta");
  return { ok: true };
}
