"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { priorityWeightsSchema } from "@/lib/validation/analytics";
import { PRIORITY_WEIGHTS_SETTING_KEY } from "@/lib/analytics-constants";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import type { Prisma } from "@prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePriorityWeights(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = priorityWeightsSchema.safeParse({
    coverage: formData.get("coverage"),
    idle: formData.get("idle"),
    space: formData.get("space"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: auth.user.tenantId, key: PRIORITY_WEIGHTS_SETTING_KEY } },
    update: { value: parsed.data as unknown as Prisma.InputJsonObject, updatedById: auth.user.id },
    create: {
      tenantId: auth.user.tenantId,
      key: PRIORITY_WEIGHTS_SETTING_KEY,
      value: parsed.data as unknown as Prisma.InputJsonObject,
      updatedById: auth.user.id,
    },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "smart_stock_engine.weights.update",
    entityType: "SystemSetting",
    ipAddress: getRequestIp(new Request("http://localhost", { headers: await headers() })),
    afterData: parsed.data as unknown as Prisma.InputJsonObject,
  });

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}
