import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { attachProgress } from "@/server/offers/engine";
import { createProductOffer, activateProductOffer, pauseProductOffer, endProductOffer } from "./actions";
import { OfferForm } from "./offer-form";
import { OfferRowActions } from "./offer-row-actions";
import type { OfferStatus } from "@prisma/client";

export const metadata = { title: "Ofertas de estoque — StockFlow B2B" };

const STATUS_LABEL: Record<OfferStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
};
const STATUS_TONE: Record<OfferStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  PAUSED: "warning",
  ENDED: "danger",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function OfertasPage() {
  const auth = await requirePermission(PERMISSIONS.OFFERS_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.OFFERS_MANAGE);
  const canApprove = auth.user.permissions.has(PERMISSIONS.OFFERS_APPROVE);

  const [offers, eligibleProducts] = await Promise.all([
    prisma.offer.findMany({
      where: { tenantId: auth.user.tenantId },
      include: { product: { include: { pricing: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: {
        tenantId: auth.user.tenantId,
        status: "ACTIVE",
        pricing: { isNot: null },
        offers: { none: { status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } } },
      },
      include: { pricing: true, inventory: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const withProgress = await attachProgress(offers);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ofertas de estoque</h1>
        <p className="text-[13px] text-text-muted">
          Condições comerciais para reduzir excedente identificado pelo Smart Stock Engine (§10).
          Uma oferta nunca fica visível ao cliente até ser aprovada, e nunca pode resultar em preço
          abaixo do mínimo configurado.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Nova oferta</CardTitle>
            <CardDescription>Fica como rascunho até ser aprovada e ativada.</CardDescription>
          </CardHeader>
          <CardContent>
            <OfferForm
              products={eligibleProducts.map((p) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                listPrice: Number(p.pricing!.listPrice),
                minPrice: p.pricing!.minPrice != null ? Number(p.pricing!.minPrice) : null,
                quantityOnHand: p.inventory?.quantityOnHand ?? 0,
              }))}
              action={createProductOffer}
            />
          </CardContent>
        </Card>
      ) : null}

      {offers.length === 0 ? (
        <EmptyState
          title="Nenhuma oferta criada ainda"
          description="Crie uma oferta a partir de um produto com excedente identificado no Smart Stock Engine (Estoque → prioridade de redução alta)."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium text-right">Desconto</th>
                <th className="px-4 py-2.5 font-medium text-right">Preço resultante</th>
                <th className="px-4 py-2.5 font-medium text-right">Meta de redução</th>
                <th className="px-4 py-2.5 font-medium text-right">Progresso real</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {withProgress.map(({ offer, reducedQuantity, progressPercent }) => {
                const listPrice = offer.product.pricing ? Number(offer.product.pricing.listPrice) : null;
                const resultingPrice = listPrice != null ? listPrice * (1 - Number(offer.discountPercent) / 100) : null;
                return (
                  <tr key={offer.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{offer.product.name}</p>
                      <p className="font-tabular text-[12px] text-text-muted">{offer.product.sku}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-tabular">{Number(offer.discountPercent)}%</td>
                    <td className="px-4 py-2.5 text-right font-tabular">
                      {resultingPrice != null ? formatCurrency(resultingPrice) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-tabular">{offer.targetReduceQuantity} un.</td>
                    <td className="px-4 py-2.5 text-right font-tabular">
                      {reducedQuantity} un. ({progressPercent}%)
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[offer.status]}>{STATUS_LABEL[offer.status]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <OfferRowActions
                        offerId={offer.id}
                        status={offer.status}
                        canApprove={canApprove}
                        canManage={canManage}
                        activateAction={activateProductOffer}
                        pauseAction={pauseProductOffer}
                        endAction={endProductOffer}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
