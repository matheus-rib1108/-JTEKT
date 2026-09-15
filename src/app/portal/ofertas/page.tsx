import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Ofertas — StockFlow B2B" };

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PortalOfertasPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Only ever selects fields safe to show a client: discount, resulting
  // price and the product's public catalog data. Never internalReason,
  // initialQuantityOnHand, targetReduceQuantity or anything about *why*
  // the offer exists (§9/§10 — no strategic/cost/position data leaks).
  const offers = await prisma.offer.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE", product: { status: "ACTIVE" } },
    select: {
      id: true,
      discountPercent: true,
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          manufacturer: true,
          application: true,
          images: { take: 1, orderBy: { position: "asc" } },
          pricing: { select: { listPrice: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ofertas</h1>
        <p className="text-[13px] text-text-muted">
          Condições comerciais especiais em produtos selecionados, por tempo limitado.
        </p>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          title="Nenhuma oferta ativa no momento"
          description="Volte em breve — novas ofertas aparecem aqui quando aprovadas pela equipe comercial."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            if (!offer.product.pricing) return null;
            const listPrice = Number(offer.product.pricing.listPrice);
            const discountPercent = Number(offer.discountPercent);
            const offerPrice = listPrice * (1 - discountPercent / 100);
            return (
              <Link
                key={offer.id}
                href={`/portal/produtos/${offer.product.id}`}
                className="block overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface hover:border-brand-400"
              >
                <div className="relative aspect-[4/3] bg-surface-muted">
                  {offer.product.images[0] ? (
                    <Image
                      src={offer.product.images[0].url}
                      alt=""
                      fill
                      sizes="300px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                  <div className="absolute left-2 top-2">
                    <Badge tone="danger">{discountPercent}% OFF</Badge>
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-tabular text-[12px] text-text-muted">{offer.product.sku}</p>
                  <p className="text-[14px] font-semibold text-foreground">{offer.product.name}</p>
                  <p className="mt-1 text-[12px] text-text-muted">
                    {offer.product.manufacturer ?? ""}
                    {offer.product.application ? ` · ${offer.product.application}` : ""}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[13px] text-text-faint line-through">{formatCurrency(listPrice)}</span>
                    <span className="text-[16px] font-semibold text-danger-600">{formatCurrency(offerPrice)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
