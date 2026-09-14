import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard — StockFlow B2B" };

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [tenant, pendingCompanies, activeCompanies, internalUsers, activeProducts, totalOnHandAgg] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { id: user.tenantId } }),
      prisma.customerCompany.count({ where: { tenantId: user.tenantId, status: "PENDING_VALIDATION" } }),
      prisma.customerCompany.count({ where: { tenantId: user.tenantId, status: "ACTIVE" } }),
      prisma.user.count({ where: { tenantId: user.tenantId, userType: "INTERNAL" } }),
      prisma.product.count({ where: { tenantId: user.tenantId, status: "ACTIVE" } }),
      prisma.inventory.aggregate({
        _sum: { quantityOnHand: true },
        where: { product: { tenantId: user.tenantId } },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Olá, {user.name.split(" ")[0]}</h2>
        <p className="text-[13px] text-text-muted">
          {tenant?.name} · Fases 1–2 concluídas (arquitetura, autenticação, catálogo e estoque).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Produtos ativos no catálogo" value={activeProducts} />
        <StatCard label="Unidades em estoque (total)" value={totalOnHandAgg._sum.quantityOnHand ?? 0} />
        <StatCard label="Empresas clientes ativas" value={activeCompanies} />
        <StatCard label="Cadastros aguardando validação" value={pendingCompanies} highlight={pendingCompanies > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ainda sem análise de estoque</CardTitle>
          <CardDescription>
            Classificação ABC/XYZ, prioridade de redução e alertas automáticos chegam na Fase 4
            (Smart Stock Engine). Os números acima são reais — quantidades e produtos já
            cadastrados nesta instalação, sem estimativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">Fase 3 — Armazém e posições</Badge>
            <Badge tone="brand">Fase 4 — ABC/XYZ e Smart Stock Engine</Badge>
            <Badge tone="brand">Fase 6 — Ofertas e preços</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-[13px] text-text-muted">
        <span>{internalUsers} contas internas ativas</span>
      </div>
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
