import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { startOrderPicking, markShipmentPacked, markShipmentShipped, markShipmentDelivered } from "./actions";
import { StartPickingButton } from "./start-picking-button";
import { ShipmentActions } from "./shipment-actions";
import type { ShipmentStatus } from "@prisma/client";

export const metadata = { title: "Logística — StockFlow B2B" };

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  PICKING: "Em separação",
  PACKED: "Embalado",
  SHIPPED: "Despachado",
  DELIVERED: "Entregue",
};
const STATUS_TONE: Record<ShipmentStatus, "neutral" | "success" | "warning" | "brand"> = {
  PICKING: "warning",
  PACKED: "brand",
  SHIPPED: "brand",
  DELIVERED: "success",
};

export default async function LogisticaPage() {
  const auth = await requirePermission(PERMISSIONS.LOGISTICS_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.LOGISTICS_MANAGE);

  const [awaitingPicking, shipments] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId: auth.user.tenantId, status: "CONFIRMED", shipment: null },
      include: { customerCompany: { select: { legalName: true } }, items: true },
      orderBy: { confirmedAt: "asc" },
    }),
    prisma.shipment.findMany({
      where: { tenantId: auth.user.tenantId, status: { not: "DELIVERED" } },
      include: { order: { include: { customerCompany: { select: { legalName: true } }, items: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Logística</h1>
        <p className="text-[13px] text-text-muted">
          Separação, embalagem e expedição dos pedidos confirmados. Nenhuma transportadora está
          integrada nesta instalação — transportadora e código de rastreio são informados
          manualmente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aguardando separação</CardTitle>
          <CardDescription>Pedidos confirmados sem separação iniciada.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {awaitingPicking.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nenhum pedido aguardando" description="Pedidos confirmados sem separação aparecem aqui." />
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  <th className="px-4 py-2.5 font-medium text-right">Itens</th>
                  <th className="px-4 py-2.5 font-medium">Confirmado em</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {awaitingPicking.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{order.customerCompany.legalName}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{order.items.length}</td>
                    <td className="px-4 py-2.5 text-text-muted">{order.confirmedAt?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canManage ? <StartPickingButton orderId={order.id} action={startOrderPicking} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Em andamento</CardTitle>
          <CardDescription>Separações iniciadas até a expedição.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {shipments.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nenhuma separação em andamento" description="Inicie a separação de um pedido acima." />
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  <th className="px-4 py-2.5 font-medium text-right">Itens</th>
                  <th className="px-4 py-2.5 font-medium">Transportadora / rastreio</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {shipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{shipment.order.customerCompany.legalName}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{shipment.order.items.length}</td>
                    <td className="px-4 py-2.5 text-text-muted">
                      {shipment.carrierName || shipment.trackingCode
                        ? `${shipment.carrierName ?? "—"} · ${shipment.trackingCode ?? "—"}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[shipment.status]}>{STATUS_LABEL[shipment.status]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canManage ? (
                        <ShipmentActions
                          shipmentId={shipment.id}
                          status={shipment.status}
                          packAction={markShipmentPacked}
                          shipAction={markShipmentShipped}
                          deliverAction={markShipmentDelivered}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
