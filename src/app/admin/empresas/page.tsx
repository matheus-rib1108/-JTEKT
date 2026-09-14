import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS, ROLES } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Empresas — StockFlow B2B" };

export default async function EmpresasPage() {
  const auth = await requirePermission(PERMISSIONS.SETTINGS_VIEW);
  if (!auth.user) return <Forbidden />;

  if (auth.user.roleKey !== ROLES.SUPER_ADMIN) {
    return (
      <EmptyState
        title="Visível apenas para Super Administrador"
        description="A gestão de múltiplas empresas (tenants) da plataforma é restrita ao Super Administrador global."
      />
    );
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true, customerCompanies: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Empresas na plataforma</h1>
        <p className="text-[13px] text-text-muted">
          Cada tenant opera com dados isolados (§37). Hoje a plataforma atende uma empresa
          operadora; a arquitetura já suporta múltiplas.
        </p>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Empresa</th>
              <th className="px-4 py-2.5 font-medium">Slug</th>
              <th className="px-4 py-2.5 font-medium">Contas internas</th>
              <th className="px-4 py-2.5 font-medium">Empresas clientes</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-4 py-2.5 font-medium text-foreground">{tenant.name}</td>
                <td className="px-4 py-2.5 font-tabular text-text-muted">{tenant.slug}</td>
                <td className="px-4 py-2.5 font-tabular">{tenant._count.users}</td>
                <td className="px-4 py-2.5 font-tabular">{tenant._count.customerCompanies}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={tenant.status === "ACTIVE" ? "success" : "danger"}>
                    {tenant.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
