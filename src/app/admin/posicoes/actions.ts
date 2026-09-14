"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { baselineSchema } from "@/lib/validation/warehouse";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { NON_STANDARD_BASELINE_KEY } from "@/lib/warehouse-constants";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setNonStandardBaseline(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = baselineSchema.safeParse({ count: formData.get("count") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: auth.user.tenantId, key: NON_STANDARD_BASELINE_KEY } },
    update: { value: { count: parsed.data.count, setAt: new Date().toISOString() }, updatedById: auth.user.id },
    create: {
      tenantId: auth.user.tenantId,
      key: NON_STANDARD_BASELINE_KEY,
      value: { count: parsed.data.count, setAt: new Date().toISOString() },
      updatedById: auth.user.id,
    },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "warehouse.non_standard_baseline.set",
    entityType: "SystemSetting",
    ipAddress: await getRequestIp(new Request("http://localhost", { headers: await headers() })),
    afterData: { count: parsed.data.count },
  });

  revalidatePath("/admin/posicoes");
  return { ok: true };
}
