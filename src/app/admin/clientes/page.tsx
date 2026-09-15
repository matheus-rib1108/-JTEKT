import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CompanyActions } from "./company-actions";

export const metadata = { title: "Clientes — StockFlow B2B" };

const STATUS_TONE = {
  PENDING_VALIDATION: "warning",
  ACTIVE: "success",
  BLOCKED: "danger",
  REJECTED: "danger",
} as const;

const STATUS_LABEL = {
  PENDING_VALIDATION: "Aguardando validação",
  ACTIVE: "Ativa",
  BLOCKED: "Bloqueada",
  REJECTED: "Rejeitada",
} as const;

export default async function ClientesPage() {
  const auth = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
  if (!auth.user) return <Forbidden />;

  const companies = await prisma.customerCompany.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { users: { where: { userType: "CLIENT" }, take: 1 } },
    take: 500,
  });

  const canManage = auth.user.permissions.has(PERMISSIONS.CUSTOMERS_MANAGE);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Empresas clientes</h1>
        <p className="text-[13px] text-text-muted">
          Empresas B2B cadastradas via autoatendimento (§8) aguardando ou já com acesso liberado.
        </p>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          title="Nenhuma empresa cliente cadastrada"
          description="Assim que uma empresa se cadastrar pelo formulário público (/register), ela aparecerá aqui para validação."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Razão social</th>
                <th className="px-4 py-2.5 font-medium">CNPJ</th>
                <th className="px-4 py-2.5 font-medium">Contato</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                {canManage ? <th className="px-4 py-2.5 font-medium text-right">Ações</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {companies.map((company) => (
                <tr key={company.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{company.legalName}</p>
                    {company.tradeName ? (
                      <p className="text-[12px] text-text-muted">{company.tradeName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 font-tabular">{formatCnpj(company.cnpj)}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {company.users[0]?.email ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[company.status]}>{STATUS_LABEL[company.status]}</Badge>
                    {company.status === "PENDING_VALIDATION" && company.reviewedById ? (
                      <p className="mt-0.5 text-[11px] text-text-muted">Revisado, aguardando 2ª aprovação</p>
                    ) : null}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-2.5">
                      <CompanyActions
                        companyId={company.id}
                        status={company.status}
                        reviewedById={company.reviewedById}
                        currentUserId={auth.user.id}
                      />
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

function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
