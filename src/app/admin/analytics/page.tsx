import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { computeOrderTotals } from "@/lib/orders";
import type { AbcClass } from "@/lib/stockClassification";

export const metadata = { title: "Analytics — StockFlow B2B" };

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ABC_TONE = { A: "brand", B: "neutral", C: "warning" } as const;

export default async function AnalyticsPage() {
  const auth = await requirePermission(PERMISSIONS.ANALYTICS_VIEW);
  if (!auth.user) return <Forbidden />;

  const [classifications, positionsByStatus, orders] = await Promise.all([
    prisma.stockClassification.findMany({
      where: { product: { tenantId: auth.user.tenantId } },
      include: { product: { select: { sku: true, name: true, unitCost: true, pricing: { select: { listPrice: true } } } } },
    }),
    prisma.storageLocation.groupBy({
      by: ["status"],
      where: { tenantId: auth.user.tenantId },
      _count: true,
    }),
    prisma.order.findMany({
      where: { tenantId: auth.user.tenantId, status: { in: ["SUBMITTED", "CONFIRMED", "CANCELLED"] } },
      select: {
        status: true,
        submittedAt: true,
        items: { select: { quantity: true, unitPrice: true, listPriceUnitPrice: true } },
      },
      orderBy: { submittedAt: "asc" },
    }),
  ]);

  if (classifications.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
        <EmptyState
          title="Classificação ainda não calculada"
          description="As análises abaixo dependem do Smart Stock Engine (valor parado, ABC/XYZ)."
          action={
            <Link href="/admin/estoque" className="text-[13px] font-medium text-brand-700 hover:underline">
              Ir para Estoque e recalcular →
            </Link>
          }
        />
      </div>
    );
  }

  // Valor parado por classe ABC — soma real (§3/§4), nunca estimado.
  const byAbc = new Map<AbcClass | "N/D", { count: number; value: number }>();
  for (const c of classifications) {
    const key = (c.abcClass as AbcClass | null) ?? "N/D";
    const valueTied = (c.factors as { valueTied?: number | null } | null)?.valueTied ?? 0;
    const entry = byAbc.get(key) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += valueTied;
    byAbc.set(key, entry);
  }

  // Top produtos por valor parado.
  const topByValue = [...classifications]
    .map((c) => ({
      sku: c.product.sku,
      name: c.product.name,
      valueTied: (c.factors as { valueTied?: number | null } | null)?.valueTied ?? null,
      priorityScore: c.priorityScore,
    }))
    .filter((p) => p.valueTied !== null)
    .sort((a, b) => (b.valueTied ?? 0) - (a.valueTied ?? 0))
    .slice(0, 10);

  // Margem por produto (só quando há preço de lista E custo cadastrados).
  const margins = classifications
    .map((c) => {
      const listPrice = c.product.pricing?.listPrice != null ? Number(c.product.pricing.listPrice) : null;
      const unitCost = c.product.unitCost != null ? Number(c.product.unitCost) : null;
      if (listPrice === null || unitCost === null || listPrice <= 0) return null;
      return { sku: c.product.sku, name: c.product.name, listPrice, unitCost, marginPercent: ((listPrice - unitCost) / listPrice) * 100 };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => a.marginPercent - b.marginPercent);

  // Pedidos por mês — só existe quando há histórico real; nunca preenchido
  // artificialmente quando a instalação é nova (§19).
  const ordersByMonth = new Map<string, { count: number; savings: number }>();
  for (const order of orders) {
    if (!order.submittedAt) continue;
    const key = order.submittedAt.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
    const totals = computeOrderTotals(
      order.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice), listPriceUnitPrice: Number(i.listPriceUnitPrice) })),
    );
    const entry = ordersByMonth.get(key) ?? { count: 0, savings: 0 };
    entry.count += 1;
    if (order.status !== "CANCELLED") entry.savings += totals.savings;
    ordersByMonth.set(key, entry);
  }

  const totalPositions = positionsByStatus.reduce((sum, p) => sum + p._count, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
        <p className="text-[13px] text-text-muted">
          Análises calculadas a partir de dados reais já cadastrados nesta instalação (§19 — nunca
          estimadas quando falta dado).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Valor parado por classe ABC</CardTitle>
            <CardDescription>Soma do valor em estoque (§3), agrupado por impacto financeiro.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-border-subtle">
                {(["A", "B", "C", "N/D"] as const).map((key) => {
                  const entry = byAbc.get(key);
                  if (!entry) return null;
                  return (
                    <tr key={key}>
                      <td className="px-5 py-2.5">
                        {key === "N/D" ? (
                          <span className="text-text-faint">N/D</span>
                        ) : (
                          <Badge tone={ABC_TONE[key as AbcClass]}>{key}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-text-muted">{entry.count} produto(s)</td>
                      <td className="px-5 py-2.5 text-right font-tabular font-medium">{formatCurrency(entry.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posições do armazém por status</CardTitle>
            <CardDescription>Ocupação real (§15/§17), {totalPositions} posições cadastradas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-border-subtle">
                {positionsByStatus.map((p) => (
                  <tr key={p.status}>
                    <td className="px-5 py-2.5">{p.status}</td>
                    <td className="px-5 py-2.5 text-right font-tabular font-medium">{p._count}</td>
                    <td className="px-5 py-2.5 text-right text-text-muted">
                      {totalPositions > 0 ? `${((p._count / totalPositions) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 produtos por valor parado</CardTitle>
          <CardDescription>Maiores valores imobilizados em estoque — candidatos naturais a ofertas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-5 py-2 font-medium">SKU</th>
                <th className="px-5 py-2 font-medium">Produto</th>
                <th className="px-5 py-2 font-medium text-right">Prioridade de redução</th>
                <th className="px-5 py-2 font-medium text-right">Valor parado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {topByValue.map((p) => (
                <tr key={p.sku}>
                  <td className="px-5 py-2.5 font-tabular text-text-muted">{p.sku}</td>
                  <td className="px-5 py-2.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-2.5 text-right font-tabular">{p.priorityScore ?? "—"}</td>
                  <td className="px-5 py-2.5 text-right font-tabular font-medium">{formatCurrency(p.valueTied ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Margem por produto</CardTitle>
          <CardDescription>
            Preço de lista vs. custo unitário — só produtos com ambos cadastrados ({margins.length} de{" "}
            {classifications.length}).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {margins.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-text-muted">
              Nenhum produto tem preço de lista e custo unitário cadastrados ao mesmo tempo ainda.
            </p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">SKU</th>
                  <th className="px-5 py-2 font-medium">Produto</th>
                  <th className="px-5 py-2 font-medium text-right">Custo</th>
                  <th className="px-5 py-2 font-medium text-right">Preço de lista</th>
                  <th className="px-5 py-2 font-medium text-right">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {margins.map((m) => (
                  <tr key={m.sku}>
                    <td className="px-5 py-2.5 font-tabular text-text-muted">{m.sku}</td>
                    <td className="px-5 py-2.5 font-medium text-foreground">{m.name}</td>
                    <td className="px-5 py-2.5 text-right font-tabular">{formatCurrency(m.unitCost)}</td>
                    <td className="px-5 py-2.5 text-right font-tabular">{formatCurrency(m.listPrice)}</td>
                    <td className={`px-5 py-2.5 text-right font-tabular font-medium ${m.marginPercent < 20 ? "text-warning-700" : ""}`}>
                      {m.marginPercent.toFixed(1)}%
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
          <CardTitle>Evolução mensal de pedidos</CardTitle>
          <CardDescription>Volume e economia concedida por mês, a partir do histórico real de pedidos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {ordersByMonth.size === 0 ? (
            <p className="px-5 py-4 text-[13px] text-text-muted">
              Ainda não há pedidos enviados suficientes para mostrar uma evolução mensal.
            </p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">Mês</th>
                  <th className="px-5 py-2 font-medium text-right">Pedidos</th>
                  <th className="px-5 py-2 font-medium text-right">Economia concedida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {[...ordersByMonth.entries()].map(([month, entry]) => (
                  <tr key={month}>
                    <td className="px-5 py-2.5 font-tabular">{month}</td>
                    <td className="px-5 py-2.5 text-right font-tabular">{entry.count}</td>
                    <td className="px-5 py-2.5 text-right font-tabular font-medium">{formatCurrency(entry.savings)}</td>
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
