"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { productPricingSchema, priceTierSchema, removePriceTierSchema } from "@/lib/validation/pricing";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { savePricing, addPriceTier, removePriceTier, PricingError } from "@/server/pricing/engine";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function saveProductPricing(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRICING_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = productPricingSchema.safeParse({
    productId: formData.get("productId"),
    listPrice: formData.get("listPrice"),
    minPrice: formData.get("minPrice"),
    exceptionReason: formData.get("exceptionReason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;

  try {
    const result = await savePricing({
      tenantId: auth.user.tenantId,
      productId: data.productId,
      listPrice: data.listPrice,
      minPrice: data.minPrice ?? null,
      actorId: auth.user.id,
      actorHasExceptionPermission: auth.user.permissions.has(PERMISSIONS.PRICING_APPROVE_EXCEPTION),
      exceptionReason: data.exceptionReason,
    });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: result.isException ? "pricing.min_price_exception" : "pricing.update",
      entityType: "Product",
      entityId: data.productId,
      ipAddress: await ipFromHeaders(),
      beforeData: result.before ?? undefined,
      afterData: { ...result.after, exceptionReason: result.isException ? data.exceptionReason : undefined },
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/admin/precos/${data.productId}`);
  revalidatePath("/admin/precos");
  revalidatePath(`/admin/produtos/${data.productId}`);
  revalidatePath("/portal/produtos");
  revalidatePath(`/portal/produtos/${data.productId}`);
  return { ok: true };
}

export async function addProductPriceTier(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRICING_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = priceTierSchema.safeParse({
    productId: formData.get("productId"),
    minQuantity: formData.get("minQuantity"),
    discountPercent: formData.get("discountPercent"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;

  try {
    const tier = await addPriceTier({
      tenantId: auth.user.tenantId,
      productId: data.productId,
      minQuantity: data.minQuantity,
      discountPercent: data.discountPercent,
    });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "pricing.tier.add",
      entityType: "Product",
      entityId: data.productId,
      ipAddress: await ipFromHeaders(),
      afterData: { ...tier },
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/admin/precos/${data.productId}`);
  revalidatePath("/portal/produtos");
  revalidatePath(`/portal/produtos/${data.productId}`);
  return { ok: true };
}

export async function removeProductPriceTier(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRICING_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = removePriceTierSchema.safeParse({ tierId: formData.get("tierId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  let productId: string;
  try {
    const result = await removePriceTier(auth.user.tenantId, parsed.data.tierId);
    productId = result.productId;

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "pricing.tier.remove",
      entityType: "Product",
      entityId: productId,
      ipAddress: await ipFromHeaders(),
      beforeData: { tierId: parsed.data.tierId },
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/admin/precos/${productId}`);
  revalidatePath("/portal/produtos");
  revalidatePath(`/portal/produtos/${productId}`);
  return { ok: true };
}
