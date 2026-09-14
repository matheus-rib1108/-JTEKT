import { requirePermission, getCurrentUser } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Relatórios — StockFlow B2B" };

function DownloadLinks({ basePath }: { basePath: string }) {
  return (
    <div className="flex gap-2">
      <a href={`${basePath}?format=csv`} className="rounded-[var(--radius-sm)] border border-border-strong px-3 py-1.5 text-[13px] hover:bg-surface-muted">
        CSV
      </a>
      <a href={`${basePath}?format=xlsx`} className="rounded-[var(--radius-sm)] border border-border-strong px-3 py-1.5 text-[13px] hover:bg-surface-muted">
        Excel
      </a>
      <a href={`${basePath}?format=pdf`} className="rounded-[var(--radius-sm)] border border-border-strong px-3 py-1.5 text-[13px] hover:bg-surface-muted">
        PDF
      </a>
    </div>
  );
}

export default async function RelatoriosPage() {
  const auth = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  if (!auth.user) return <Forbidden />;

  const user = await getCurrentUser();
  const canViewAudit = user?.permissions.has(PERMISSIONS.AUDIT_VIEW) ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Relatórios</h1>
        <p className="text-[13px] text-text-muted">
          Exportação de dados já cadastrados nesta instalação — nada é gerado a partir de dados
          simulados.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estoque</CardTitle>
            <CardDescription>SKU, quantidades (em mãos/reservado/bloqueado/disponível), custo e valor parado por produto.</CardDescription>
          </CardHeader>
          <CardContent>
            <DownloadLinks basePath="/api/reports/estoque" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
            <CardDescription>Histórico de pedidos enviados, com status, itens, total e economia concedida.</CardDescription>
          </CardHeader>
          <CardContent>
            <DownloadLinks basePath="/api/reports/pedidos" />
          </CardContent>
        </Card>

        {canViewAudit ? (
          <Card>
            <CardHeader>
              <CardTitle>Auditoria</CardTitle>
              <CardDescription>Últimos 1.000 eventos da trilha de auditoria (§28) — mesma permissão da página Auditoria.</CardDescription>
            </CardHeader>
            <CardContent>
              <DownloadLinks basePath="/api/reports/auditoria" />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
