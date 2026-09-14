"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { productSchema, movementSchema, inventorySettingsSchema } from "@/lib/validation/catalog";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { registerMovement, updateCommercialAvailability, InventoryError } from "@/server/inventory/engine";
import type { Prisma } from "@prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

function readProductFormData(formData: FormData) {
  return {
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    manufacturer: formData.get("manufacturer"),
    model: formData.get("model"),
    unit: formData.get("unit"),
    minCommercialQuantity: formData.get("minCommercialQuantity"),
    status: formData.get("status"),
    specifications: formData.get("specifications"),
  };
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = productSchema.safeParse(readProductFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const existing = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId: auth.user.tenantId, sku: data.sku } },
  });
  if (existing) return { ok: false, error: "Já existe um produto com este SKU." };

  const product = await prisma.product.create({
    data: {
      tenantId: auth.user.tenantId,
      sku: data.sku,
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId || null,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      unit: data.unit,
      minCommercialQuantity: data.minCommercialQuantity,
      status: data.status,
      specifications: data.specifications,
      inventory: { create: {} },
    },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "product.create",
    entityType: "Product",
    entityId: product.id,
    ipAddress: await ipFromHeaders(),
    afterData: { sku: product.sku, name: product.name, status: product.status },
  });

  revalidatePath("/admin/produtos");
  redirect(`/admin/produtos/${product.id}`);
}

export async function updateProduct(productId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = productSchema.safeParse(readProductFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const current = await prisma.product.findFirst({
    where: { id: productId, tenantId: auth.user.tenantId },
  });
  if (!current) return { ok: false, error: "Produto não encontrado." };

  if (data.sku !== current.sku) {
    const skuTaken = await prisma.product.findUnique({
      where: { tenantId_sku: { tenantId: auth.user.tenantId, sku: data.sku } },
    });
    if (skuTaken) return { ok: false, error: "Já existe um produto com este SKU." };
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      sku: data.sku,
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId || null,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      unit: data.unit,
      minCommercialQuantity: data.minCommercialQuantity,
      status: data.status,
      specifications: data.specifications,
    },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "product.update",
    entityType: "Product",
    entityId: updated.id,
    ipAddress: await ipFromHeaders(),
    beforeData: { name: current.name, status: current.status, sku: current.sku },
    afterData: { name: updated.name, status: updated.status, sku: updated.sku },
  });

  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true };
}

export async function registerProductMovement(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = movementSchema.safeParse({
    productId: formData.get("productId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  try {
    const { before, after } = await registerMovement({
      tenantId: auth.user.tenantId,
      productId: data.productId,
      type: data.type,
      quantity: data.quantity,
      reason: data.reason,
      performedById: auth.user.id,
    });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "inventory.movement",
      entityType: "Product",
      entityId: data.productId,
      ipAddress: await ipFromHeaders(),
      beforeData: { ...before } as Prisma.InputJsonObject,
      afterData: { ...after, movementType: data.type, quantity: data.quantity } as Prisma.InputJsonObject,
    });
  } catch (error) {
    if (error instanceof InventoryError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/admin/produtos/${data.productId}`);
  revalidatePath("/admin/estoque");
  return { ok: true };
}

export async function updateProductAvailability(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = inventorySettingsSchema.safeParse({
    productId: formData.get("productId"),
    quantityAvailableToSell: formData.get("quantityAvailableToSell"),
    reorderPoint: formData.get("reorderPoint") || undefined,
    maxStock: formData.get("maxStock") || undefined,
    safetyStock: formData.get("safetyStock") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  try {
    const { before, after } = await updateCommercialAvailability({
      tenantId: auth.user.tenantId,
      productId: data.productId,
      quantityAvailableToSell: data.quantityAvailableToSell,
      reorderPoint: data.reorderPoint,
      maxStock: data.maxStock,
      safetyStock: data.safetyStock,
    });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "inventory.commercial_availability.update",
      entityType: "Product",
      entityId: data.productId,
      ipAddress: await ipFromHeaders(),
      beforeData: { ...before } as Prisma.InputJsonObject,
      afterData: { ...after } as Prisma.InputJsonObject,
    });
  } catch (error) {
    if (error instanceof InventoryError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/admin/produtos/${data.productId}`);
  revalidatePath("/admin/estoque");
  return { ok: true };
}
