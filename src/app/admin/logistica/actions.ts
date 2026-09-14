"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { orderIdSchema, shipmentIdSchema, markShippedSchema } from "@/lib/validation/logistics";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { startPicking, markPacked, markShipped, markDelivered, LogisticsError } from "@/server/logistics/engine";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function startOrderPicking(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.LOGISTICS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = orderIdSchema.safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const shipment = await startPicking(auth.user.tenantId, parsed.data.orderId, auth.user.id);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "shipment.start_picking",
      entityType: "Shipment",
      entityId: shipment.id,
      ipAddress: await ipFromHeaders(),
      afterData: { orderId: shipment.orderId, status: shipment.status },
    });
  } catch (error) {
    if (error instanceof LogisticsError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/logistica");
  return { ok: true };
}

export async function markShipmentPacked(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.LOGISTICS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = shipmentIdSchema.safeParse({ shipmentId: formData.get("shipmentId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const shipment = await markPacked(auth.user.tenantId, parsed.data.shipmentId);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "shipment.mark_packed",
      entityType: "Shipment",
      entityId: shipment.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: shipment.status },
    });
  } catch (error) {
    if (error instanceof LogisticsError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/logistica");
  return { ok: true };
}

export async function markShipmentShipped(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.LOGISTICS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = markShippedSchema.safeParse({
    shipmentId: formData.get("shipmentId"),
    carrierName: formData.get("carrierName"),
    trackingCode: formData.get("trackingCode"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const shipment = await markShipped({
      tenantId: auth.user.tenantId,
      shipmentId: parsed.data.shipmentId,
      carrierName: parsed.data.carrierName,
      trackingCode: parsed.data.trackingCode,
      performedById: auth.user.id,
    });
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "shipment.mark_shipped",
      entityType: "Shipment",
      entityId: shipment.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: shipment.status, carrierName: shipment.carrierName, trackingCode: shipment.trackingCode },
    });
  } catch (error) {
    if (error instanceof LogisticsError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/logistica");
  revalidatePath("/admin/estoque");
  revalidatePath("/portal/pedidos");
  return { ok: true };
}

export async function markShipmentDelivered(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.LOGISTICS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = shipmentIdSchema.safeParse({ shipmentId: formData.get("shipmentId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const shipment = await markDelivered(auth.user.tenantId, parsed.data.shipmentId);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "shipment.mark_delivered",
      entityType: "Shipment",
      entityId: shipment.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: shipment.status },
    });
  } catch (error) {
    if (error instanceof LogisticsError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/logistica");
  revalidatePath("/portal/pedidos");
  return { ok: true };
}
