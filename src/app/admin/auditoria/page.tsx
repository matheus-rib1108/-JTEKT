import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Auditoria — StockFlow B2B" };

export default async function AuditoriaPage() {
  const auth = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  if (!auth.user) return <Forbidden />;

  const logs = await prisma.auditLog.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Log de auditoria</h1>
        <p className="text-[13px] text-text-muted">
          Trilha append-only de ações sensíveis (§28) — login, cadastro, aprovação de clientes,
          convites de usuário e redefinição de senha. Últimos 100 eventos.
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="Nenhum evento registrado ainda" description="Ações de login, cadastro e aprovação aparecerão aqui." />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data/hora</th>
                <th className="px-4 py-2.5 font-medium">Ação</th>
                <th className="px-4 py-2.5 font-medium">Entidade</th>
                <th className="px-4 py-2.5 font-medium">Autor</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2.5 font-tabular text-text-muted">
                    {log.createdAt.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{log.action}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {log.entityType}
                    {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{log.actor?.email ?? "—"}</td>
                  <td className="px-4 py-2.5 font-tabular text-text-muted">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
