"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveAlertSchema } from "@/lib/validation/analytics";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function resolveAlert(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.ALERTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = resolveAlertSchema.safeParse({ alertId: formData.get("alertId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const alert = await prisma.alert.findFirst({
    where: { id: parsed.data.alertId, tenantId: auth.user.tenantId },
  });
  if (!alert) return { ok: false, error: "Alerta não encontrado." };

  await prisma.alert.update({
    where: { id: alert.id },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: auth.user.id },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "alert.resolve",
    entityType: "Alert",
    entityId: alert.id,
    ipAddress: getRequestIp(new Request("http://localhost", { headers: await headers() })),
    beforeData: { status: alert.status },
    afterData: { status: "RESOLVED" },
  });

  revalidatePath("/admin/alertas");
  return { ok: true };
}
