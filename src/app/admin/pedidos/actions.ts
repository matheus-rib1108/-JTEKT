"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { orderIdSchema, cancelOrderSchema } from "@/lib/validation/orders";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { confirmOrder, cancelOrder, OrderError } from "@/server/orders/engine";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function confirmCustomerOrder(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.ORDERS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = orderIdSchema.safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const order = await confirmOrder(auth.user.tenantId, parsed.data.orderId, auth.user.id);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "order.confirm",
      entityType: "Order",
      entityId: order.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: order.status },
    });
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/pedidos");
  return { ok: true };
}

export async function cancelCustomerOrder(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.ORDERS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = cancelOrderSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const order = await cancelOrder(auth.user.tenantId, parsed.data.orderId, auth.user.id, parsed.data.reason);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "order.cancel",
      entityType: "Order",
      entityId: order.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: order.status, reason: parsed.data.reason },
    });
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/portal/pedidos");
  return { ok: true };
}
