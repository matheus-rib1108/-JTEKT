import { PrismaClient } from "@prisma/client";

/** Direct DB access for E2E test setup/teardown only — specs themselves
 * drive the app through the browser, never through this client. Used to
 * (a) generate collision-free fixture data and (b) verify side effects
 * (inventory movements, reservation math) that aren't visible in the UI. */
export const prisma = new PrismaClient();

export const E2E_LEGAL_NAME_PREFIX = "E2E QA —";

/** Deletes every CustomerCompany created by this suite (matched by the
 * fixed legal-name prefix, never a real demo/tenant name) along with their
 * client users. Safe to call only after each spec has driven any Order it
 * created to a terminal state (delivered or cancelled) through the real
 * app actions — deleting an Order row directly, instead of going through
 * cancelOrder/markDelivered, would orphan its stock reservation exactly
 * like the bug found and fixed in Fase 7/9. */
export async function cleanupE2ECompanies(): Promise<void> {
  const companies = await prisma.customerCompany.findMany({
    where: { legalName: { startsWith: E2E_LEGAL_NAME_PREFIX } },
  });
  const seedAdmin = await prisma.user.findFirst({ where: { email: "admin@jtekt.demo" } });

  for (const company of companies) {
    // Safety net: if a spec failed partway through (e.g. an assertion after
    // submitting an order but before the flow reached a terminal state),
    // that order would still be holding a live reservation. Release it
    // before deleting the company — a raw delete would cascade-delete the
    // Order row and orphan the reservation forever (exactly the class of
    // bug documented in docs/ROADMAP.md's "Débitos técnicos conhecidos").
    // This mirrors (but doesn't import — that module is "server-only" and
    // can't load outside Next's server runtime) the release half of
    // src/server/orders/engine.ts's cancelOrder.
    const danglingItems = await prisma.orderItem.findMany({
      where: { order: { customerCompanyId: company.id, status: { in: ["SUBMITTED", "CONFIRMED"] } } },
    });
    for (const item of danglingItems) {
      const inventory = await prisma.inventory.findUnique({ where: { productId: item.productId } });
      if (!inventory) continue;
      const releasedReserved = Math.max(0, inventory.quantityReserved - item.quantity);
      await prisma.inventory.update({
        where: { productId: item.productId },
        data: { quantityReserved: releasedReserved },
      });
      await prisma.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: "LIBERACAO_RESERVA",
          quantity: item.quantity,
          reason: "Limpeza automática de teste E2E (pedido não concluído pelo cenário)",
          resultingQuantityOnHand: inventory.quantityOnHand,
          performedById: seedAdmin?.id,
        },
      });
    }
    await prisma.order.updateMany({
      where: { customerCompanyId: company.id, status: { in: ["SUBMITTED", "CONFIRMED"] } },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: seedAdmin?.id,
        cancellationReason: "Limpeza automática de teste E2E",
      },
    });

    await prisma.user.deleteMany({ where: { customerCompanyId: company.id } });
    await prisma.customerCompany.delete({ where: { id: company.id } });
  }
}

/** Safety net for the MFA login spec: if an assertion fails mid-test after
 * MFA was enabled on the shared seeded admin but before the spec disabled
 * it again, later specs/manual sessions logging in as that admin would
 * unexpectedly hit the MFA step. Only touches the row if MFA is still on. */
export async function ensureSeedAdminMfaDisabled(email: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email } });
  if (user?.mfaEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });
  }
}
