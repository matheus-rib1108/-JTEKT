"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  productSchema,
  movementSchema,
  inventorySettingsSchema,
  addProductImageSchema,
  removeProductImageSchema,
  addProductDocumentSchema,
  removeProductDocumentSchema,
} from "@/lib/validation/catalog";
import { allocationSchema } from "@/lib/validation/warehouse";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { registerMovement, updateCommercialAvailability, InventoryError } from "@/server/inventory/engine";
import { allocateProduct, WarehouseError } from "@/server/warehouse/engine";
import { saveProductUpload, deleteLocalUpload, UploadError } from "@/server/uploads/storage";
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
    application: formData.get("application"),
    unit: formData.get("unit"),
    minCommercialQuantity: formData.get("minCommercialQuantity"),
    status: formData.get("status"),
    unitCost: formData.get("unitCost"),
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
      application: data.application || null,
      unit: data.unit,
      minCommercialQuantity: data.minCommercialQuantity,
      status: data.status,
      unitCost: data.unitCost ?? null,
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
      application: data.application || null,
      unit: data.unit,
      minCommercialQuantity: data.minCommercialQuantity,
      status: data.status,
      unitCost: data.unitCost ?? null,
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

export async function allocateProductToLocation(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = allocationSchema.safeParse({
    productId: formData.get("productId"),
    storageLocationId: formData.get("storageLocationId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  try {
    const result = await allocateProduct({ tenantId: auth.user.tenantId, ...data });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "product.storage_allocation.update",
      entityType: "Product",
      entityId: data.productId,
      ipAddress: await ipFromHeaders(),
      beforeData: { code: result.code, quantity: result.previousQuantity } as Prisma.InputJsonObject,
      afterData: { code: result.code, quantity: result.newQuantity } as Prisma.InputJsonObject,
    });
  } catch (error) {
    if (error instanceof WarehouseError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/admin/produtos/${data.productId}`);
  revalidatePath("/admin/armazem");
  revalidatePath("/admin/estoque");
  return { ok: true };
}

export async function addProductImage(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = addProductImageSchema.safeParse({
    productId: formData.get("productId"),
    url: formData.get("url"),
    altText: formData.get("altText"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;

  const product = await prisma.product.findFirst({ where: { id: data.productId, tenantId: auth.user.tenantId } });
  if (!product) return { ok: false, error: "Produto não encontrado." };

  const file = formData.get("file");
  let url: string;
  try {
    if (file instanceof File && file.size > 0) {
      const saved = await saveProductUpload(file, "image", auth.user.tenantId, data.productId);
      url = saved.url;
    } else if (data.url) {
      url = data.url;
    } else {
      return { ok: false, error: "Informe uma URL de imagem ou envie um arquivo." };
    }
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, error: error.message };
    throw error;
  }

  const image = await prisma.productImage.create({
    data: { productId: data.productId, url, altText: data.altText || null },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "product.image.add",
    entityType: "Product",
    entityId: data.productId,
    ipAddress: await ipFromHeaders(),
    afterData: { imageId: image.id, url },
  });

  revalidatePath(`/admin/produtos/${data.productId}`);
  revalidatePath("/admin/produtos");
  revalidatePath("/portal/produtos");
  return { ok: true };
}

export async function removeProductImage(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = removeProductImageSchema.safeParse({ imageId: formData.get("imageId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const image = await prisma.productImage.findFirst({
    where: { id: parsed.data.imageId, product: { tenantId: auth.user.tenantId } },
  });
  if (!image) return { ok: false, error: "Imagem não encontrada." };

  await prisma.productImage.delete({ where: { id: image.id } });
  await deleteLocalUpload(image.url);

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "product.image.remove",
    entityType: "Product",
    entityId: image.productId,
    ipAddress: await ipFromHeaders(),
    beforeData: { imageId: image.id, url: image.url },
  });

  revalidatePath(`/admin/produtos/${image.productId}`);
  revalidatePath("/admin/produtos");
  revalidatePath("/portal/produtos");
  return { ok: true };
}

export async function addProductDocument(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = addProductDocumentSchema.safeParse({
    productId: formData.get("productId"),
    label: formData.get("label"),
    url: formData.get("url"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;

  const product = await prisma.product.findFirst({ where: { id: data.productId, tenantId: auth.user.tenantId } });
  if (!product) return { ok: false, error: "Produto não encontrado." };

  const file = formData.get("file");
  let url: string;
  try {
    if (file instanceof File && file.size > 0) {
      const saved = await saveProductUpload(file, "document", auth.user.tenantId, data.productId);
      url = saved.url;
    } else if (data.url) {
      url = data.url;
    } else {
      return { ok: false, error: "Informe uma URL de documento ou envie um arquivo PDF." };
    }
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, error: error.message };
    throw error;
  }

  const document = await prisma.productDocument.create({
    data: { productId: data.productId, label: data.label, url },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "product.document.add",
    entityType: "Product",
    entityId: data.productId,
    ipAddress: await ipFromHeaders(),
    afterData: { documentId: document.id, label: document.label, url },
  });

  revalidatePath(`/admin/produtos/${data.productId}`);
  revalidatePath("/portal/produtos");
  return { ok: true };
}

export async function removeProductDocument(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = removeProductDocumentSchema.safeParse({ documentId: formData.get("documentId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const document = await prisma.productDocument.findFirst({
    where: { id: parsed.data.documentId, product: { tenantId: auth.user.tenantId } },
  });
  if (!document) return { ok: false, error: "Documento não encontrado." };

  await prisma.productDocument.delete({ where: { id: document.id } });
  await deleteLocalUpload(document.url);

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "product.document.remove",
    entityType: "Product",
    entityId: document.productId,
    ipAddress: await ipFromHeaders(),
    beforeData: { documentId: document.id, label: document.label, url: document.url },
  });

  revalidatePath(`/admin/produtos/${document.productId}`);
  revalidatePath("/portal/produtos");
  return { ok: true };
}
