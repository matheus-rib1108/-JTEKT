import Link from "next/link";
import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { EmptyState } from "@/components/ui/empty-state";
import { computeOrderTotals } from "@/lib/orders";
import { updateCartItem, removeProductFromCart, submitCart } from "./actions";
import { CartPanel } from "./cart-panel";

export const metadata = { title: "Carrinho — StockFlow B2B" };

export default async function PortalCarrinhoPage() {
  const user = await getCurrentUser();
  if (!user || !user.customerCompanyId) return null;

  const cart = await prisma.order.findFirst({
    where: { tenantId: user.tenantId, customerCompanyId: user.customerCompanyId, status: "DRAFT" },
    include: {
      items: {
        include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Carrinho</h1>
        <EmptyState
          title="Seu carrinho está vazio"
          description="Adicione produtos a partir da página de detalhe de cada item no catálogo."
          action={
            <Link href="/portal/produtos" className="text-[13px] font-medium text-brand-700 hover:underline">
              Ver produtos →
            </Link>
          }
        />
      </div>
    );
  }

  const totals = computeOrderTotals(
    items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice), listPriceUnitPrice: Number(i.listPriceUnitPrice) })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Carrinho</h1>
        <p className="text-[13px] text-text-muted">
          Revise itens e quantidades antes de finalizar. Ao finalizar, o estoque correspondente é
          reservado imediatamente.
        </p>
      </div>

      <CartPanel
        items={items.map((i) => ({
          id: i.id,
          sku: i.product.sku,
          name: i.product.name,
          imageUrl: i.product.images[0]?.url ?? null,
          unit: i.product.unit,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          listPriceUnitPrice: Number(i.listPriceUnitPrice),
          discountSource: i.discountSource,
          minCommercialQuantity: i.product.minCommercialQuantity,
        }))}
        subtotal={totals.subtotal}
        listSubtotal={totals.listSubtotal}
        savings={totals.savings}
        updateAction={updateCartItem}
        removeAction={removeProductFromCart}
        submitAction={submitCart}
      />
    </div>
  );
}
