import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { computeOrderTotals } from "@/lib/orders";
import { confirmCustomerOrder, cancelCustomerOrder } from "./actions";
import { OrderRowActions } from "./order-row-actions";
import type { OrderStatus, Prisma } from "@prisma/client";

export const metadata = { title: "Pedidos — StockFlow B2B" };

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

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const auth = await requirePermission(PERMISSIONS.ORDERS_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.ORDERS_MANAGE);
  const params = await searchParams;

  const where: Prisma.OrderWhereInput = { tenantId: auth.user.tenantId, status: { not: "DRAFT" } };
  if (params.status) where.status = params.status as OrderStatus;

  const orders = await prisma.order.findMany({
    where,
    include: {
      customerCompany: { select: { legalName: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Pedidos</h1>
        <p className="text-[13px] text-text-muted">
          Pedidos enviados a partir do carrinho do portal. A reserva de estoque acontece no envio;
          confirmar ou cancelar aqui não altera a reserva além de liberá-la no cancelamento.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["SUBMITTED", "CONFIRMED", "CANCELLED"] as const).map((status) => (
          <Link
            key={status}
            href={`/admin/pedidos?status=${status}`}
            className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-[13px] ${
              params.status === status ? "border-brand-500 bg-brand-50 text-brand-800" : "border-border-strong text-text-muted hover:bg-surface-muted"
            }`}
          >
            {STATUS_LABEL[status]}
          </Link>
        ))}
        {params.status ? (
          <Link href="/admin/pedidos" className="text-[13px] text-text-muted hover:underline">
            Limpar filtro
          </Link>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido encontrado"
          description="Pedidos aparecem aqui depois que um cliente finaliza o carrinho no portal."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="px-4 py-2.5 font-medium">Enviado em</th>
                <th className="px-4 py-2.5 font-medium text-right">Itens</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
                <th className="px-4 py-2.5 font-medium text-right">Economia</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {orders.map((order) => {
                const totals = computeOrderTotals(
                  order.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice), listPriceUnitPrice: Number(i.listPriceUnitPrice) })),
                );
                return (
                  <tr key={order.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-2.5 font-medium text-foreground">{order.customerCompany.legalName}</td>
                    <td className="px-4 py-2.5 text-text-muted">{order.submittedAt?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{order.items.length}</td>
                    <td className="px-4 py-2.5 text-right font-tabular font-medium">{formatCurrency(totals.subtotal)}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">
                      {totals.savings > 0 ? formatCurrency(totals.savings) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <OrderRowActions
                        orderId={order.id}
                        status={order.status}
                        canManage={canManage}
                        confirmAction={confirmCustomerOrder}
                        cancelAction={cancelCustomerOrder}
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
