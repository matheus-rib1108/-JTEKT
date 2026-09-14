"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { warehouseSchema, bulkGenerateSchema, statusChangeSchema, nonStandardSchema } from "@/lib/validation/warehouse";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { bulkGeneratePositions, setManualStatus, setNonStandard, WarehouseError } from "@/server/warehouse/engine";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function createWarehouse(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = warehouseSchema.safeParse({ code: formData.get("code"), name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const existing = await prisma.warehouse.findUnique({
    where: { tenantId_code: { tenantId: auth.user.tenantId, code: parsed.data.code } },
  });
  if (existing) return { ok: false, error: "Já existe um galpão com este código." };

  const warehouse = await prisma.warehouse.create({
    data: { tenantId: auth.user.tenantId, code: parsed.data.code, name: parsed.data.name },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "warehouse.create",
    entityType: "Warehouse",
    entityId: warehouse.id,
    ipAddress: await ipFromHeaders(),
    afterData: { code: warehouse.code, name: warehouse.name },
  });

  revalidatePath("/admin/armazem");
  return { ok: true };
}

export async function generatePositions(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = bulkGenerateSchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    area: formData.get("area"),
    corridor: formData.get("corridor"),
    rack: formData.get("rack"),
    levelCount: formData.get("levelCount"),
    positionsPerLevel: formData.get("positionsPerLevel"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const result = await bulkGeneratePositions({ tenantId: auth.user.tenantId, ...parsed.data });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "storage_location.bulk_generate",
      entityType: "StorageLocation",
      ipAddress: await ipFromHeaders(),
      afterData: { ...parsed.data, created: result.created, skipped: result.skipped },
    });

    revalidatePath("/admin/armazem");
    return {
      ok: true,
      message: `${result.created} posições criadas${result.skipped > 0 ? `, ${result.skipped} já existiam` : ""}.`,
    };
  } catch (error) {
    if (error instanceof WarehouseError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function changeLocationStatus(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = statusChangeSchema.safeParse({
    storageLocationId: formData.get("storageLocationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { before } = await setManualStatus({ tenantId: auth.user.tenantId, ...parsed.data });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "storage_location.status_change",
      entityType: "StorageLocation",
      entityId: parsed.data.storageLocationId,
      ipAddress: await ipFromHeaders(),
      beforeData: { status: before },
      afterData: { status: parsed.data.status },
    });

    revalidatePath("/admin/armazem");
    revalidatePath("/admin/posicoes");
    return { ok: true };
  } catch (error) {
    if (error instanceof WarehouseError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function toggleNonStandard(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = nonStandardSchema.safeParse({
    storageLocationId: formData.get("storageLocationId"),
    isNonStandard: formData.get("isNonStandard"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { before, code } = await setNonStandard({ tenantId: auth.user.tenantId, ...parsed.data });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: parsed.data.isNonStandard ? "storage_location.mark_non_standard" : "storage_location.mark_corrected",
      entityType: "StorageLocation",
      entityId: parsed.data.storageLocationId,
      ipAddress: await ipFromHeaders(),
      beforeData: { isNonStandard: before, code },
      afterData: { isNonStandard: parsed.data.isNonStandard, code },
    });

    revalidatePath("/admin/armazem");
    revalidatePath("/admin/posicoes");
    return { ok: true };
  } catch (error) {
    if (error instanceof WarehouseError) return { ok: false, error: error.message };
    throw error;
  }
}
