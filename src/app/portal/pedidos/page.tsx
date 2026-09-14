import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { computeOrderTotals } from "@/lib/orders";
import type { OrderStatus } from "@prisma/client";

export const metadata = { title: "Meus pedidos — StockFlow B2B" };

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Carrinho",
  SUBMITTED: "Enviado",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};
const STATUS_TONE: Record<OrderStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "warning",
  CONFIRMED: "success",
  CANCELLED: "danger",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PortalPedidosPage() {
  const user = await getCurrentUser();
  if (!user || !user.customerCompanyId) return null;

  const orders = await prisma.order.findMany({
    where: { tenantId: user.tenantId, customerCompanyId: user.customerCompanyId, status: { not: "DRAFT" } },
    include: { items: { include: { product: { select: { name: true, sku: true, unit: true } } } } },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Meus pedidos</h1>
        <p className="text-[13px] text-text-muted">Histórico de pedidos enviados por esta conta.</p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido enviado ainda"
          description="Pedidos enviados a partir do carrinho aparecem aqui."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const totals = computeOrderTotals(
              order.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice), listPriceUnitPrice: Number(i.listPriceUnitPrice) })),
            );
            return (
              <Card key={order.id}>
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] text-text-muted">
                        Enviado em {order.submittedAt?.toLocaleString("pt-BR") ?? "—"}
                      </p>
                      <p className="font-tabular text-[12px] text-text-faint">{order.id}</p>
                    </div>
                    <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  </div>

                  <ul className="mt-3 space-y-1 border-t border-border-subtle pt-3 text-[13px]">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="text-text-muted">
                          {item.quantity} {item.product.unit} × {item.product.name}
                        </span>
                        <span className="font-tabular font-medium text-foreground">
                          {formatCurrency(Number(item.unitPrice) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap justify-end gap-4 border-t border-border-subtle pt-3 text-[13px]">
                    {totals.savings > 0 ? (
                      <p className="text-success-600">
                        Economia: <span className="font-tabular font-semibold">{formatCurrency(totals.savings)}</span>
                      </p>
                    ) : null}
                    <p className="font-semibold text-foreground">
                      Total: <span className="font-tabular">{formatCurrency(totals.subtotal)}</span>
                    </p>
                  </div>

                  {order.status === "CANCELLED" && order.cancellationReason ? (
                    <p className="mt-2 text-[12px] text-text-muted">Motivo do cancelamento: {order.cancellationReason}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
