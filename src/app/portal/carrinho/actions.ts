"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { addCartItemSchema, updateCartItemSchema, removeCartItemSchema } from "@/lib/validation/orders";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { addCartItem, updateCartItemQuantity, removeCartItem, submitOrder, OrderError } from "@/server/orders/engine";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function addProductToCart(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_ORDERS_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = addCartItemSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await addCartItem({
      tenantId: auth.user.tenantId,
      customerCompanyId: auth.user.customerCompanyId,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      userId: auth.user.id,
    });
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/carrinho");
  return { ok: true };
}

export async function updateCartItem(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_ORDERS_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = updateCartItemSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await updateCartItemQuantity({
      tenantId: auth.user.tenantId,
      customerCompanyId: auth.user.customerCompanyId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
    });
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/carrinho");
  return { ok: true };
}

export async function removeProductFromCart(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_ORDERS_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = removeCartItemSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    await removeCartItem(auth.user.tenantId, auth.user.customerCompanyId, parsed.data.itemId);
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/carrinho");
  return { ok: true };
}

export async function submitCart(): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_ORDERS_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  try {
    const result = await submitOrder(auth.user.tenantId, auth.user.customerCompanyId, auth.user.id);

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "order.submit",
      entityType: "Order",
      entityId: result.order.id,
      ipAddress: await ipFromHeaders(),
      afterData: { ...result.totals, status: result.order.status },
    });
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/carrinho");
  revalidatePath("/portal/pedidos");
  revalidatePath("/admin/pedidos");
  return { ok: true };
}
