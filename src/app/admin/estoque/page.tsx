import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecomputeButton } from "./recompute-button";

export const metadata = { title: "Estoque — StockFlow B2B" };

const ABC_TONE = { A: "brand", B: "neutral", C: "warning" } as const;
const XYZ_LABEL = { X: "Previsível", Y: "Variável", Z: "Irregular" } as const;

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ abc?: string; xyz?: string }>;
}) {
  const auth = await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.INVENTORY_MANAGE);
  const params = await searchParams;

  const products = await prisma.product.findMany({
    where: { tenantId: auth.user.tenantId, status: { not: "DISCONTINUED" } },
    include: { inventory: true, category: true, classification: true },
    orderBy: { name: "asc" },
  });

  const filtered = products.filter((p) => {
    if (params.abc && p.classification?.abcClass !== params.abc) return false;
    if (params.xyz && p.classification?.xyzClass !== params.xyz) return false;
    return true;
  });

  const totalOnHand = products.reduce((sum, p) => sum + (p.inventory?.quantityOnHand ?? 0), 0);
  const belowReorder = products.filter(
    (p) => p.inventory?.reorderPoint != null && p.inventory.quantityOnHand < p.inventory.reorderPoint,
  );
  const classifiedCount = products.filter((p) => p.classification !== null).length;
  const lastComputedAt = products
    .map((p) => p.classification?.computedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Estoque</h1>
          <p className="text-[13px] text-text-muted">
            Classificação ABC (impacto financeiro) e XYZ (previsibilidade de demanda) do Smart
            Stock Engine, com índice de prioridade de redução (§3/§4).{" "}
            {lastComputedAt
              ? `Última atualização: ${lastComputedAt.toLocaleString("pt-BR")}.`
              : "Ainda não calculado — clique em recalcular."}
          </p>
        </div>
        {canManage ? <RecomputeButton /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-[12px] text-text-muted">Produtos com estoque</p>
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
        <Card>
          <CardContent className="py-4">
            <p className="text-[12px] text-text-muted">Classificados</p>
            <p className="mt-1.5 font-tabular text-2xl font-semibold text-foreground">
              {classifiedCount}/{products.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-text-muted">Filtrar por ABC:</span>
        {["A", "B", "C"].map((cls) => (
          <Link key={cls} href={`/admin/estoque?${params.xyz ? `xyz=${params.xyz}&` : ""}abc=${cls}`}>
            <Button variant={params.abc === cls ? "primary" : "outline"} size="sm">
              {cls}
            </Button>
          </Link>
        ))}
        <span className="ml-3 text-[12px] text-text-muted">XYZ:</span>
        {["X", "Y", "Z"].map((cls) => (
          <Link key={cls} href={`/admin/estoque?${params.abc ? `abc=${params.abc}&` : ""}xyz=${cls}`}>
            <Button variant={params.xyz === cls ? "primary" : "outline"} size="sm">
              {cls}
            </Button>
          </Link>
        ))}
        {(params.abc || params.xyz) && (
          <Link href="/admin/estoque">
            <Button variant="ghost" size="sm">
              Limpar filtros
            </Button>
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={products.length === 0 ? "Nenhum produto ativo com estoque" : "Nenhum produto corresponde ao filtro"}
          description={
            products.length === 0
              ? "Cadastre produtos em Produtos para começar a acompanhar o estoque aqui."
              : "Ajuste ou limpe o filtro para ver outros produtos."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium text-right">Em mãos</th>
                <th className="px-4 py-2.5 font-medium">ABC</th>
                <th className="px-4 py-2.5 font-medium">XYZ</th>
                <th className="px-4 py-2.5 font-medium text-right">Prioridade</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((product) => {
                const inv = product.inventory;
                const below = inv?.reorderPoint != null && inv.quantityOnHand < inv.reorderPoint;
                const cls = product.classification;
                return (
                  <tr key={product.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-2.5 font-tabular">
                      <Link href={`/admin/produtos/${product.id}`} className="text-brand-700 hover:underline">
                        {product.sku}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{product.name}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{inv?.quantityOnHand ?? 0}</td>
                    <td className="px-4 py-2.5">
                      {cls?.abcClass ? (
                        <Badge tone={ABC_TONE[cls.abcClass as "A" | "B" | "C"]}>{cls.abcClass}</Badge>
                      ) : (
                        <span className="text-text-faint">N/D</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {cls?.xyzClass ? (
                        <span title={XYZ_LABEL[cls.xyzClass as "X" | "Y" | "Z"]}>{cls.xyzClass}</span>
                      ) : (
                        <span className="text-text-faint">N/D</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-tabular">
                      {cls?.priorityScore != null ? (
                        <span className={cls.priorityScore >= 70 ? "font-semibold text-warning-700" : ""}>
                          {cls.priorityScore}
                        </span>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </td>
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
