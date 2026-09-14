import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { computeUnitPrice } from "@/lib/pricing";
import { saveProductPricing, addProductPriceTier, removeProductPriceTier } from "../actions";
import { PricingForm } from "./pricing-form";
import { TiersPanel } from "./tiers-panel";

export const metadata = { title: "Preço do produto — StockFlow B2B" };

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ProductPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.PRICING_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.PRICING_MANAGE);
  const canException = auth.user.permissions.has(PERMISSIONS.PRICING_APPROVE_EXCEPTION);

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    include: { pricing: { include: { tiers: true } } },
  });
  if (!product) notFound();

  const tiers = (product.pricing?.tiers ?? []).map((t) => ({
    id: t.id,
    minQuantity: t.minQuantity,
    discountPercent: Number(t.discountPercent),
  }));

  const examples = product.pricing
    ? [1, ...tiers.map((t) => t.minQuantity)]
        .sort((a, b) => a - b)
        .filter((qty, i, arr) => arr.indexOf(qty) === i)
        .map((qty) => ({ qty, ...computeUnitPrice(Number(product.pricing!.listPrice), tiers, qty) }))
    : [];

  return (
    <div className="space-y-5">
      <Link href="/admin/precos" className="text-[13px] text-brand-700 hover:underline">
        ← Preços
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-foreground">{product.name}</h1>
        <p className="font-tabular text-[13px] text-text-muted">{product.sku}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preço de lista e mínimo</CardTitle>
            <CardDescription>
              O preço mínimo é a margem que nenhuma venda, faixa de desconto ou oferta pode furar
              sem aprovação explícita e auditada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <PricingForm
                productId={product.id}
                initialListPrice={product.pricing ? String(product.pricing.listPrice) : ""}
                initialMinPrice={product.pricing?.minPrice != null ? String(product.pricing.minPrice) : ""}
                canException={canException}
                action={saveProductPricing}
              />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-text-faint">Preço de lista</dt>
                  <dd className="font-medium text-foreground">
                    {product.pricing ? formatCurrency(Number(product.pricing.listPrice)) : "Não configurado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-text-faint">Preço mínimo</dt>
                  <dd className="font-medium text-foreground">
                    {product.pricing?.minPrice != null ? formatCurrency(Number(product.pricing.minPrice)) : "—"}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faixas de desconto por quantidade</CardTitle>
            <CardDescription>Desconto progressivo aplicado a partir da quantidade mínima.</CardDescription>
          </CardHeader>
          <CardContent>
            {!product.pricing ? (
              <p className="text-[13px] text-text-muted">Configure o preço de lista antes de adicionar faixas.</p>
            ) : canManage ? (
              <TiersPanel
                productId={product.id}
                tiers={tiers}
                addAction={addProductPriceTier}
                removeAction={removeProductPriceTier}
              />
            ) : tiers.length === 0 ? (
              <p className="text-[13px] text-text-muted">Nenhuma faixa de desconto cadastrada.</p>
            ) : (
              <ul className="space-y-1 text-[13px]">
                {tiers.map((t) => (
                  <li key={t.id}>
                    {t.minQuantity} un. — {t.discountPercent}%
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {product.pricing && examples.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Simulação de preço por quantidade</CardTitle>
            <CardDescription>Preço unitário resultante em cada faixa, a partir do preço de lista atual.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">Quantidade</th>
                  <th className="px-5 py-2 font-medium text-right">Desconto</th>
                  <th className="px-5 py-2 font-medium text-right">Preço unitário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {examples.map((ex) => (
                  <tr key={ex.qty}>
                    <td className="px-5 py-2 font-tabular">{ex.qty}+ un.</td>
                    <td className="px-5 py-2 text-right font-tabular">{ex.discountPercent}%</td>
                    <td className="px-5 py-2 text-right font-tabular font-medium">{formatCurrency(ex.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
