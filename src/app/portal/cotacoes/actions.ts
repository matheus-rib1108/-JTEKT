"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { requestQuoteSchema, quoteIdSchema } from "@/lib/validation/quotes";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { requestQuote, acceptQuote, rejectQuote, cancelQuote, QuoteError } from "@/server/quotes/engine";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function requestProductQuote(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_QUOTES_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = requestQuoteSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    requestedPrice: formData.get("requestedPrice"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const quote = await requestQuote({
      tenantId: auth.user.tenantId,
      customerCompanyId: auth.user.customerCompanyId,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      requestedPrice: parsed.data.requestedPrice,
      message: parsed.data.message,
      userId: auth.user.id,
    });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "quote.request",
      entityType: "Quote",
      entityId: quote.id,
      ipAddress: await ipFromHeaders(),
      afterData: { productId: parsed.data.productId, quantity: parsed.data.quantity },
    });
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/cotacoes");
  return { ok: true };
}

export async function acceptProductQuote(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_QUOTES_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = quoteIdSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const quote = await acceptQuote(auth.user.tenantId, auth.user.customerCompanyId, parsed.data.quoteId, auth.user.id);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "quote.accept",
      entityType: "Quote",
      entityId: quote.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: quote.status, resultingOrderId: quote.resultingOrderId },
    });
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/cotacoes");
  revalidatePath("/portal/pedidos");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/cotacoes");
  return { ok: true };
}

export async function rejectProductQuote(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_QUOTES_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = quoteIdSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const quote = await rejectQuote(auth.user.tenantId, auth.user.customerCompanyId, parsed.data.quoteId);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "quote.reject",
      entityType: "Quote",
      entityId: quote.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: quote.status },
    });
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/cotacoes");
  revalidatePath("/admin/cotacoes");
  return { ok: true };
}

export async function cancelProductQuote(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CLIENT_QUOTES_MANAGE);
  if (!auth.user || !auth.user.customerCompanyId) return { ok: false, error: "Não autorizado." };

  const parsed = quoteIdSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const quote = await cancelQuote(auth.user.tenantId, auth.user.customerCompanyId, parsed.data.quoteId);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "quote.cancel",
      entityType: "Quote",
      entityId: quote.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: quote.status },
    });
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/portal/cotacoes");
  revalidatePath("/admin/cotacoes");
  return { ok: true };
}
