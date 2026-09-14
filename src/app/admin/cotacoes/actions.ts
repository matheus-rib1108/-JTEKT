"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { proposeQuoteSchema } from "@/lib/validation/quotes";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { proposeQuote, QuoteError } from "@/server/quotes/engine";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function respondToQuote(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.QUOTES_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = proposeQuoteSchema.safeParse({
    quoteId: formData.get("quoteId"),
    proposedUnitPrice: formData.get("proposedUnitPrice"),
    responseMessage: formData.get("responseMessage"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const quote = await proposeQuote({
      tenantId: auth.user.tenantId,
      quoteId: parsed.data.quoteId,
      proposedUnitPrice: parsed.data.proposedUnitPrice,
      responseMessage: parsed.data.responseMessage,
      respondedById: auth.user.id,
    });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "quote.propose",
      entityType: "Quote",
      entityId: quote.id,
      ipAddress: await ipFromHeaders(),
      afterData: { proposedUnitPrice: parsed.data.proposedUnitPrice, status: quote.status },
    });
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/cotacoes");
  revalidatePath(`/admin/cotacoes/${parsed.data.quoteId}`);
  revalidatePath("/portal/cotacoes");
  return { ok: true };
}
