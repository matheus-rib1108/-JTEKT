import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteUserForm } from "./invite-user-form";

export const metadata = { title: "Minha empresa — StockFlow B2B" };

const STATUS_LABEL: Record<string, string> = {
  PENDING_VALIDATION: "Aguardando validação",
  ACTIVE: "Ativa",
  BLOCKED: "Bloqueada",
  REJECTED: "Rejeitada",
};

export default async function ContaPage() {
  const user = await getCurrentUser();
  if (!user || !user.customerCompanyId) return null;

  const [company, users] = await Promise.all([
    prisma.customerCompany.findUnique({ where: { id: user.customerCompanyId } }),
    prisma.user.findMany({
      where: { customerCompanyId: user.customerCompanyId },
      include: { role: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const canManage = user.permissions.has(PERMISSIONS.CLIENT_COMPANY_MANAGE);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Minha empresa</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{company?.legalName}</CardTitle>
          <CardDescription>CNPJ {formatCnpj(company?.cnpj ?? "")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <span className="text-[13px] text-text-muted">Status:</span>
          <Badge tone={company?.status === "ACTIVE" ? "success" : "warning"}>
            {STATUS_LABEL[company?.status ?? ""] ?? company?.status}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários da empresa</CardTitle>
          <CardDescription>
            {canManage
              ? "Convide colegas da sua empresa para acessar a plataforma."
              : "Apenas o administrador da empresa pode convidar novos usuários."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage ? <InviteUserForm /> : null}
          <div className="divide-y divide-border-subtle">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{u.name}</p>
                  <p className="text-[12px] text-text-muted">{u.email}</p>
                </div>
                <Badge tone={u.status === "ACTIVE" ? "success" : "warning"}>{u.role.name}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
