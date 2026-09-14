"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { runSmartStockEngine } from "@/server/analytics/engine";
import type { Prisma } from "@prisma/client";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function recomputeSmartStockEngine(): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const summary = await runSmartStockEngine(auth.user.tenantId);

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "smart_stock_engine.recompute",
    entityType: "Tenant",
    ipAddress: getRequestIp(new Request("http://localhost", { headers: await headers() })),
    afterData: { ...summary } as unknown as Prisma.InputJsonObject,
  });

  revalidatePath("/admin/estoque");
  revalidatePath("/admin/alertas");
  revalidatePath("/admin/produtos");

  return {
    ok: true,
    message: `${summary.productsClassified} produtos classificados (${summary.abcCounted} com custo cadastrado) · ${summary.alertsOpened} alertas novos · ${summary.alertsResolved} resolvidos automaticamente.`,
  };
}
