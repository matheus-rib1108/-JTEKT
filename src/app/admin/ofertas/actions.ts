"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createOfferSchema, offerIdSchema } from "@/lib/validation/pricing";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";
import { createOffer, activateOffer, pauseOffer, endOffer, OfferError } from "@/server/offers/engine";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

export async function createProductOffer(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.OFFERS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = createOfferSchema.safeParse({
    productId: formData.get("productId"),
    discountPercent: formData.get("discountPercent"),
    targetReduceQuantity: formData.get("targetReduceQuantity"),
    internalReason: formData.get("internalReason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;

  try {
    const offer = await createOffer({
      tenantId: auth.user.tenantId,
      productId: data.productId,
      discountPercent: data.discountPercent,
      targetReduceQuantity: data.targetReduceQuantity,
      internalReason: data.internalReason,
      createdById: auth.user.id,
    });

    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "offer.create",
      entityType: "Offer",
      entityId: offer.id,
      ipAddress: await ipFromHeaders(),
      afterData: { productId: offer.productId, discountPercent: Number(offer.discountPercent), targetReduceQuantity: offer.targetReduceQuantity },
    });
  } catch (error) {
    if (error instanceof OfferError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/ofertas");
  return { ok: true };
}

export async function activateProductOffer(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.OFFERS_APPROVE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = offerIdSchema.safeParse({ offerId: formData.get("offerId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const offer = await activateOffer(auth.user.tenantId, parsed.data.offerId, auth.user.id);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "offer.activate",
      entityType: "Offer",
      entityId: offer.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: offer.status, startedAt: offer.startedAt?.toISOString() },
    });
  } catch (error) {
    if (error instanceof OfferError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/ofertas");
  revalidatePath("/portal/ofertas");
  return { ok: true };
}

export async function pauseProductOffer(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.OFFERS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = offerIdSchema.safeParse({ offerId: formData.get("offerId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const offer = await pauseOffer(auth.user.tenantId, parsed.data.offerId);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "offer.pause",
      entityType: "Offer",
      entityId: offer.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: offer.status },
    });
  } catch (error) {
    if (error instanceof OfferError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/ofertas");
  revalidatePath("/portal/ofertas");
  return { ok: true };
}

export async function endProductOffer(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.OFFERS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = offerIdSchema.safeParse({ offerId: formData.get("offerId") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const offer = await endOffer(auth.user.tenantId, parsed.data.offerId);
    await writeAuditLog({
      tenantId: auth.user.tenantId,
      actorUserId: auth.user.id,
      action: "offer.end",
      entityType: "Offer",
      entityId: offer.id,
      ipAddress: await ipFromHeaders(),
      afterData: { status: offer.status, endedAt: offer.endedAt?.toISOString() },
    });
  } catch (error) {
    if (error instanceof OfferError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/ofertas");
  revalidatePath("/portal/ofertas");
  return { ok: true };
}
