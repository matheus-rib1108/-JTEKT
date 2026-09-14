import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Prisma, ProductStatus } from "@prisma/client";

export const metadata = { title: "Produtos — StockFlow B2B" };

const STATUS_LABEL = { DRAFT: "Rascunho", ACTIVE: "Ativo", DISCONTINUED: "Descontinuado" } as const;
const STATUS_TONE = { DRAFT: "neutral", ACTIVE: "success", DISCONTINUED: "danger" } as const;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; status?: string }>;
}) {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.PRODUCTS_MANAGE);
  const params = await searchParams;

  const where: Prisma.ProductWhereInput = { tenantId: auth.user.tenantId };
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.status) where.status = params.status as ProductStatus;
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
      { manufacturer: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, inventory: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.category.findMany({ where: { tenantId: auth.user.tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Produtos</h1>
          <p className="text-[13px] text-text-muted">
            Cadastro técnico de peças e componentes (§10). Estoque e disponibilidade comercial são
            gerenciados na página de cada produto.
          </p>
        </div>
        {canManage ? (
          <Link href="/admin/produtos/novo">
            <Button>Novo produto</Button>
          </Link>
        ) : null}
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nome, SKU ou fabricante"
          className="h-9 w-64 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px]"
        />
        <select
          name="categoryId"
          defaultValue={params.categoryId ?? ""}
          className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px]"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px]"
        >
          <option value="">Todos os status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="ACTIVE">Ativo</option>
          <option value="DISCONTINUED">Descontinuado</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description={
            canManage
              ? "Cadastre o primeiro produto para começar a controlar o estoque."
              : "Ainda não há produtos cadastrados nesta instalação."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium text-right">Em estoque</th>
                <th className="px-4 py-2.5 font-medium text-right">Disponível p/ venda</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5 font-tabular">
                    <Link href={`/admin/produtos/${product.id}`} className="text-brand-700 hover:underline">
                      {product.sku}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{product.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{product.category?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-tabular">{product.inventory?.quantityOnHand ?? 0}</td>
                  <td className="px-4 py-2.5 text-right font-tabular">
                    {product.inventory?.quantityAvailableToSell ?? 0}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[product.status]}>{STATUS_LABEL[product.status]}</Badge>
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
