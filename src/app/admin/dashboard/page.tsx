import Link from "next/link";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeOrderTotals } from "@/lib/orders";

export const metadata = { title: "Dashboard — StockFlow B2B" };

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const HIGH_PRIORITY_THRESHOLD = 70;

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [
    tenant,
    pendingCompanies,
    activeCompanies,
    activeProducts,
    totalOnHandAgg,
    classifications,
    activeOffersCount,
    nonStandardPositions,
    totalPositions,
    openOrders,
    completedOrders,
    productsWithMargin,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.customerCompany.count({ where: { tenantId: user.tenantId, status: "PENDING_VALIDATION" } }),
    prisma.customerCompany.count({ where: { tenantId: user.tenantId, status: "ACTIVE" } }),
    prisma.product.count({ where: { tenantId: user.tenantId, status: "ACTIVE" } }),
    prisma.inventory.aggregate({ _sum: { quantityOnHand: true }, where: { product: { tenantId: user.tenantId } } }),
    prisma.stockClassification.findMany({
      where: { product: { tenantId: user.tenantId } },
      select: { priorityScore: true, factors: true },
    }),
    prisma.offer.count({ where: { tenantId: user.tenantId, status: "ACTIVE" } }),
    prisma.storageLocation.count({ where: { tenantId: user.tenantId, isNonStandard: true } }),
    prisma.storageLocation.count({ where: { tenantId: user.tenantId } }),
    prisma.order.count({ where: { tenantId: user.tenantId, status: { in: ["SUBMITTED", "CONFIRMED"] } } }),
    prisma.order.findMany({
      where: { tenantId: user.tenantId, status: { in: ["SUBMITTED", "CONFIRMED", "CANCELLED"] } },
      select: {
        status: true,
        items: { select: { quantity: true, unitPrice: true, listPriceUnitPrice: true } },
      },
    }),
    prisma.product.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE", unitCost: { not: null }, pricing: { isNot: null } },
      select: { unitCost: true, pricing: { select: { listPrice: true } } },
    }),
  ]);

  // Total value tied up in stock — only ever computed from products with a
  // real unitCost on file, same rule as the Smart Stock Engine (§3/§4/§19:
  // never guess a number when the input data isn't there).
  const stockValueByProduct = classifications
    .map((c) => (c.factors as { valueTied?: number | null } | null)?.valueTied ?? null)
    .filter((v): v is number => v !== null);
  const totalStockValue = stockValueByProduct.reduce((sum, v) => sum + v, 0);
  const classifiedCount = classifications.length;

  const surplusItems = classifications.filter((c) => (c.priorityScore ?? 0) >= HIGH_PRIORITY_THRESHOLD);
  const surplusValue = surplusItems.reduce(
    (sum, c) => sum + ((c.factors as { valueTied?: number | null } | null)?.valueTied ?? 0),
    0,
  );

  const margins = productsWithMargin
    .filter((p) => p.pricing && Number(p.pricing.listPrice) > 0)
    .map((p) => ((Number(p.pricing!.listPrice) - Number(p.unitCost)) / Number(p.pricing!.listPrice)) * 100);
  const averageMargin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : null;

  const nonCancelledOrders = completedOrders.filter((o) => o.status !== "CANCELLED");
  const totalSavingsGranted = nonCancelledOrders.reduce((sum, order) => {
    const totals = computeOrderTotals(
      order.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice), listPriceUnitPrice: Number(i.listPriceUnitPrice) })),
    );
    return sum + totals.savings;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Olá, {user.name.split(" ")[0]}</h2>
        <p className="text-[13px] text-text-muted">{tenant?.name}</p>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">Estoque</h3>
        {classifiedCount === 0 ? (
          <EmptyState
            title="Classificação ainda não calculada"
            description="Valor em estoque e estoque excedente dependem do Smart Stock Engine."
            action={
              <Link href="/admin/estoque" className="text-[13px] font-medium text-brand-700 hover:underline">
                Ir para Estoque e recalcular →
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Valor total em estoque"
              value={formatCurrency(totalStockValue)}
              footnote={`${classifiedCount} produto(s) com custo cadastrado`}
            />
            <StatCard
              label="Estoque excedente (prioridade ≥ 70)"
              value={formatCurrency(surplusValue)}
              footnote={`${surplusItems.length} produto(s)`}
              highlight={surplusItems.length > 0}
            />
            <StatCard
              label="Posições fora do padrão"
              value={`${nonStandardPositions} / ${totalPositions}`}
              highlight={nonStandardPositions > 0}
            />
            <StatCard label="Ofertas ativas" value={activeOffersCount} />
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">Comercial</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Margem média (lista vs. custo)"
            value={averageMargin != null ? `${averageMargin.toFixed(1)}%` : "N/D"}
            footnote={averageMargin != null ? `${margins.length} produto(s) com preço e custo cadastrados` : "Nenhum produto com preço e custo cadastrados"}
          />
          <StatCard label="Pedidos em aberto" value={openOrders} />
          <StatCard label="Economia concedida a clientes" value={formatCurrency(totalSavingsGranted)} footnote="Pedidos enviados, histórico completo" />
          <StatCard label="Produtos ativos no catálogo" value={activeProducts} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">Contas</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Empresas clientes ativas" value={activeCompanies} />
          <StatCard label="Cadastros aguardando validação" value={pendingCompanies} highlight={pendingCompanies > 0} />
          <StatCard label="Unidades em estoque (total)" value={totalOnHandAgg._sum.quantityOnHand ?? 0} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sobre estes números</CardTitle>
          <CardDescription>
            Todos os valores acima vêm de dados já cadastrados nesta instalação. Nenhum número é
            estimado quando falta dado real (§19) — por isso &ldquo;N/D&rdquo; aparece em vez de um
            valor quando não há custo ou preço suficiente cadastrado.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  footnote,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  footnote?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[12px] text-text-muted">{label}</p>
        <p className={`mt-1.5 font-tabular text-2xl font-semibold ${highlight ? "text-warning-700" : "text-foreground"}`}>
          {value}
        </p>
        {footnote ? <p className="mt-1 text-[11px] text-text-faint">{footnote}</p> : null}
      </CardContent>
    </Card>
  );
}
