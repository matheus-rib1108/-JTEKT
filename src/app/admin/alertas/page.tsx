import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ResolveButton } from "./resolve-button";

export const metadata = { title: "Central de alertas — StockFlow B2B" };

const TYPE_LABEL = {
  BELOW_REORDER_POINT: "Abaixo do estoque mínimo",
  ABOVE_MAX_STOCK: "Acima do estoque máximo",
  IDLE_STOCK: "Sem movimentação",
  MANY_POSITIONS_OCCUPIED: "Muitas posições ocupadas",
  NON_STANDARD_POSITION: "Posição fora do padrão",
} as const;

const SEVERITY_TONE = { INFO: "neutral", WARNING: "warning", CRITICAL: "danger" } as const;

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const auth = await requirePermission(PERMISSIONS.ALERTS_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.ALERTS_MANAGE);
  const params = await searchParams;
  const statusFilter = params.status === "RESOLVED" ? "RESOLVED" : "OPEN";

  const [alerts, openCount, criticalCount] = await Promise.all([
    prisma.alert.findMany({
      where: { tenantId: auth.user.tenantId, status: statusFilter },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.alert.count({ where: { tenantId: auth.user.tenantId, status: "OPEN" } }),
    prisma.alert.count({ where: { tenantId: auth.user.tenantId, status: "OPEN", severity: "CRITICAL" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Central de alertas</h1>
        <p className="text-[13px] text-text-muted">
          Gerados pelo Smart Stock Engine a cada recálculo (§22). Cotação/pedido/margem entram
          quando essas fases existirem — por ora, apenas estoque, armazém e posições.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="text-[12px] text-text-muted">Alertas abertos</p>
            <p className="mt-1.5 font-tabular text-2xl font-semibold text-foreground">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[12px] text-text-muted">Críticos</p>
            <p className={`mt-1.5 font-tabular text-2xl font-semibold ${criticalCount > 0 ? "text-danger-600" : "text-foreground"}`}>
              {criticalCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Link href="/admin/alertas?status=OPEN">
          <Badge tone={statusFilter === "OPEN" ? "brand" : "neutral"}>Abertos</Badge>
        </Link>
        <Link href="/admin/alertas?status=RESOLVED">
          <Badge tone={statusFilter === "RESOLVED" ? "brand" : "neutral"}>Resolvidos</Badge>
        </Link>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title={statusFilter === "OPEN" ? "Nenhum alerta aberto" : "Nenhum alerta resolvido ainda"}
          description={
            statusFilter === "OPEN"
              ? "Recalcule em Estoque para gerar alertas a partir dos dados atuais."
              : "Alertas resolvidos aparecem aqui."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Severidade</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Mensagem</th>
                <th className="px-4 py-2.5 font-medium">Criado</th>
                {canManage && statusFilter === "OPEN" ? <th className="px-4 py-2.5 font-medium text-right">Ações</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-4 py-2.5">
                    <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{TYPE_LABEL[alert.type]}</td>
                  <td className="px-4 py-2.5 text-foreground">
                    {alert.productId ? (
                      <Link href={`/admin/produtos/${alert.productId}`} className="hover:underline">
                        {alert.message}
                      </Link>
                    ) : alert.storageLocationId ? (
                      <Link href="/admin/posicoes" className="hover:underline">
                        {alert.message}
                      </Link>
                    ) : (
                      alert.message
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-tabular text-text-muted">
                    {alert.createdAt.toLocaleString("pt-BR")}
                  </td>
                  {canManage && statusFilter === "OPEN" ? (
                    <td className="px-4 py-2.5">
                      <ResolveButton alertId={alert.id} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
