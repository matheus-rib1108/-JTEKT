import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Motor de preços — StockFlow B2B" };

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PrecosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; semPreco?: string }>;
}) {
  const auth = await requirePermission(PERMISSIONS.PRICING_VIEW);
  if (!auth.user) return <Forbidden />;

  const params = await searchParams;

  const where: Prisma.ProductWhereInput = { tenantId: auth.user.tenantId, status: { not: "DISCONTINUED" } };
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.semPreco === "1") where.pricing = null;

  const products = await prisma.product.findMany({
    where,
    include: { pricing: { include: { tiers: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  const withoutPricing = products.filter((p) => !p.pricing).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Motor de preços</h1>
        <p className="text-[13px] text-text-muted">
          Preço de lista, preço mínimo (margem) e descontos progressivos por quantidade, por
          produto. Um preço de lista abaixo do mínimo exige um usuário com permissão de exceção e
          fica sempre auditado — nunca é aprovado automaticamente.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nome ou SKU"
          className="h-9 w-64 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px]"
        />
        <label className="flex items-center gap-1.5 text-[13px] text-text-muted">
          <input type="checkbox" name="semPreco" value="1" defaultChecked={params.semPreco === "1"} />
          Sem preço configurado
        </label>
        <button
          type="submit"
          className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px] hover:bg-surface-muted"
        >
          Filtrar
        </button>
      </form>

      {withoutPricing > 0 ? (
        <p className="text-[12px] text-text-muted">
          {withoutPricing} produto(s) sem preço de lista configurado ainda.
        </p>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Ajuste o filtro ou cadastre produtos em Produtos antes de configurar preços."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium text-right">Preço de lista</th>
                <th className="px-4 py-2.5 font-medium text-right">Preço mínimo</th>
                <th className="px-4 py-2.5 font-medium text-right">Faixas de desconto</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5 font-tabular text-text-muted">{product.sku}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{product.name}</td>
                  <td className="px-4 py-2.5 text-right font-tabular">
                    {product.pricing ? formatCurrency(Number(product.pricing.listPrice)) : <Badge tone="warning">Não configurado</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-tabular">
                    {product.pricing?.minPrice != null ? formatCurrency(Number(product.pricing.minPrice)) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-tabular">{product.pricing?.tiers.length ?? 0}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/precos/${product.id}`} className="text-brand-700 hover:underline">
                      Gerenciar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
