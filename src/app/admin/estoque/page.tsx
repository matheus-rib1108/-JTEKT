import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Estoque — StockFlow B2B" };

export default async function EstoquePage() {
  const auth = await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  if (!auth.user) return <Forbidden />;

  const products = await prisma.product.findMany({
    where: { tenantId: auth.user.tenantId, status: { not: "DISCONTINUED" } },
    include: { inventory: true, category: true },
    orderBy: { name: "asc" },
  });

  const totalOnHand = products.reduce((sum, p) => sum + (p.inventory?.quantityOnHand ?? 0), 0);
  const belowReorder = products.filter(
    (p) => p.inventory?.reorderPoint != null && p.inventory.quantityOnHand < p.inventory.reorderPoint,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Estoque</h1>
        <p className="text-[13px] text-text-muted">
          Visão consolidada de quantidades por produto. Classificação ABC/XYZ e prioridade de
          redução chegam na Fase 4 (Smart Stock Engine) — aqui são apenas os números reais
          cadastrados até agora.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-[12px] text-text-muted">Produtos com estoque cadastrado</p>
            <p className="mt-1.5 font-tabular text-2xl font-semibold text-foreground">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[12px] text-text-muted">Unidades em mãos (total)</p>
            <p className="mt-1.5 font-tabular text-2xl font-semibold text-foreground">{totalOnHand}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[12px] text-text-muted">Abaixo do estoque mínimo</p>
            <p className={`mt-1.5 font-tabular text-2xl font-semibold ${belowReorder.length > 0 ? "text-warning-700" : "text-foreground"}`}>
              {belowReorder.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto ativo com estoque"
          description="Cadastre produtos em Produtos para começar a acompanhar o estoque aqui."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium text-right">Em mãos</th>
                <th className="px-4 py-2.5 font-medium text-right">Reservado</th>
                <th className="px-4 py-2.5 font-medium text-right">Bloqueado</th>
                <th className="px-4 py-2.5 font-medium text-right">Disponível p/ venda</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {products.map((product) => {
                const inv = product.inventory;
                const below = inv?.reorderPoint != null && inv.quantityOnHand < inv.reorderPoint;
                return (
                  <tr key={product.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-2.5 font-tabular">
                      <Link href={`/admin/produtos/${product.id}`} className="text-brand-700 hover:underline">
                        {product.sku}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{product.name}</td>
                    <td className="px-4 py-2.5 text-text-muted">{product.category?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{inv?.quantityOnHand ?? 0}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{inv?.quantityReserved ?? 0}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{inv?.quantityBlocked ?? 0}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{inv?.quantityAvailableToSell ?? 0}</td>
                    <td className="px-4 py-2.5">
                      {below ? <Badge tone="warning">Abaixo do mínimo</Badge> : <Badge tone="success">Normal</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
