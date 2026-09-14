import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard — StockFlow B2B" };

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [tenant, pendingCompanies, activeCompanies, internalUsers] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.customerCompany.count({ where: { tenantId: user.tenantId, status: "PENDING_VALIDATION" } }),
    prisma.customerCompany.count({ where: { tenantId: user.tenantId, status: "ACTIVE" } }),
    prisma.user.count({ where: { tenantId: user.tenantId, userType: "INTERNAL" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Olá, {user.name.split(" ")[0]}</h2>
        <p className="text-[13px] text-text-muted">
          {tenant?.name} · Fase 1 concluída (arquitetura, banco de dados e autenticação).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contas internas" value={internalUsers} />
        <StatCard label="Empresas clientes ativas" value={activeCompanies} />
        <StatCard label="Cadastros aguardando validação" value={pendingCompanies} highlight={pendingCompanies > 0} />
        <StatCard label="Fase atual" value="1 / 15" isText />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sem dados operacionais ainda</CardTitle>
          <CardDescription>
            Estoque, produtos, ofertas, preços e pedidos entram nas próximas fases. Este dashboard
            não exibe métricas simuladas — os indicadores acima refletem apenas contas e empresas
            reais já cadastradas nesta instalação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">Fase 2 — Produtos e estoque</Badge>
            <Badge tone="brand">Fase 3 — Armazém e posições</Badge>
            <Badge tone="brand">Fase 4 — ABC/XYZ e Smart Stock Engine</Badge>
            <Badge tone="brand">Fase 6 — Ofertas e preços</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  isText,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  isText?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[12px] text-text-muted">{label}</p>
        <p
          className={`mt-1.5 font-tabular text-2xl font-semibold ${
            highlight ? "text-warning-700" : "text-foreground"
          } ${isText ? "font-sans text-lg" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
