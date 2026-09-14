import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Produtos — StockFlow B2B" };

export default async function PortalProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;

  const where: Prisma.ProductWhereInput = { tenantId: user.tenantId, status: "ACTIVE" };
  if (params.categoryId) where.categoryId = params.categoryId;
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
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.category.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Produtos</h1>
        <p className="text-[13px] text-text-muted">
          Catálogo técnico de peças e componentes disponíveis para esta conta. Cotação e pedido
          chegam nas próximas fases — por ora, use esta página para consulta técnica.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nome, código ou fabricante"
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
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto disponível"
          description="Ainda não há produtos publicados no catálogo desta conta, ou nenhum corresponde ao filtro aplicado."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const available = (product.inventory?.quantityAvailableToSell ?? 0) > 0;
            const specs = Array.isArray(product.specifications)
              ? (product.specifications as { key: string; value: string }[]).slice(0, 3)
              : [];
            return (
              <div key={product.id} className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-tabular text-[12px] text-text-muted">{product.sku}</p>
                    <p className="text-[14px] font-semibold text-foreground">{product.name}</p>
                  </div>
                  <Badge tone={available ? "success" : "neutral"}>
                    {available ? "Disponível para compra" : "Indisponível"}
                  </Badge>
                </div>
                <p className="mt-2 text-[12px] text-text-muted">
                  {product.category?.name ?? "Sem categoria"}
                  {product.manufacturer ? ` · ${product.manufacturer}` : ""}
                </p>
                {specs.length > 0 ? (
                  <dl className="mt-3 space-y-1 border-t border-border-subtle pt-3 text-[12px]">
                    {specs.map((spec) => (
                      <div key={spec.key} className="flex justify-between gap-2">
                        <dt className="text-text-faint">{spec.key}</dt>
                        <dd className="font-medium text-foreground">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <p className="mt-3 text-[12px] text-text-muted">
                  Quantidade mínima de compra: <span className="font-medium text-foreground">{product.minCommercialQuantity} {product.unit}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
