import Link from "next/link";
import Image from "next/image";
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
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    manufacturer?: string;
    application?: string;
    availability?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;

  const where: Prisma.ProductWhereInput = { tenantId: user.tenantId, status: "ACTIVE" };
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.manufacturer) where.manufacturer = params.manufacturer;
  if (params.application) where.application = params.application;
  if (params.availability === "available") where.inventory = { quantityAvailableToSell: { gt: 0 } };
  if (params.availability === "unavailable") where.inventory = { quantityAvailableToSell: { lte: 0 } };
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
      { manufacturer: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [products, categories, manufacturers, applications] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        inventory: true,
        images: { take: 1, orderBy: { position: "asc" } },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.category.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE", manufacturer: { not: null } },
      select: { manufacturer: true },
      distinct: ["manufacturer"],
      orderBy: { manufacturer: "asc" },
    }),
    prisma.product.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE", application: { not: null } },
      select: { application: true },
      distinct: ["application"],
      orderBy: { application: "asc" },
    }),
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
        <select
          name="manufacturer"
          defaultValue={params.manufacturer ?? ""}
          className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px]"
        >
          <option value="">Todos os fabricantes</option>
          {manufacturers.map((p) => (
            <option key={p.manufacturer} value={p.manufacturer ?? ""}>
              {p.manufacturer}
            </option>
          ))}
        </select>
        <select
          name="application"
          defaultValue={params.application ?? ""}
          className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px]"
        >
          <option value="">Todas as aplicações</option>
          {applications.map((p) => (
            <option key={p.application} value={p.application ?? ""}>
              {p.application}
            </option>
          ))}
        </select>
        <select
          name="availability"
          defaultValue={params.availability ?? ""}
          className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px]"
        >
          <option value="">Disponibilidade (todas)</option>
          <option value="available">Disponível para compra</option>
          <option value="unavailable">Indisponível</option>
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
              <Link
                key={product.id}
                href={`/portal/produtos/${product.id}`}
                className="block rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 hover:border-brand-400"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-border-subtle bg-surface-muted">
                    {product.images[0] ? (
                      <Image src={product.images[0].url} alt="" fill sizes="56px" className="object-cover" unoptimized />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-tabular text-[12px] text-text-muted">{product.sku}</p>
                        <p className="text-[14px] font-semibold text-foreground">{product.name}</p>
                      </div>
                      <Badge tone={available ? "success" : "neutral"}>
                        {available ? "Disponível" : "Indisponível"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-text-muted">
                      {product.category?.name ?? "Sem categoria"}
                      {product.manufacturer ? ` · ${product.manufacturer}` : ""}
                    </p>
                  </div>
                </div>
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
                  Quantidade mínima de compra:{" "}
                  <span className="font-medium text-foreground">
                    {product.minCommercialQuantity} {product.unit}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
