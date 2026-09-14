"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type ActionResult = { ok: true } | { ok: false; error: string };

export interface CartItemView {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  listPriceUnitPrice: number;
  // "QUOTE" only ever appears on Order items created straight from an
  // accepted quote (src/server/quotes/engine.ts), never on a DRAFT
  // cart item — included here only so this type stays assignable from
  // Prisma's OrderItemDiscountSource without a cast.
  discountSource: "NONE" | "TIER" | "OFFER" | "QUOTE";
  minCommercialQuantity: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CartPanel({
  items,
  subtotal,
  listSubtotal,
  savings,
  updateAction,
  removeAction,
  submitAction,
}: {
  items: CartItemView[];
  subtotal: number;
  listSubtotal: number;
  savings: number;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  removeAction: (formData: FormData) => Promise<ActionResult>;
  submitAction: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(itemId: string, quantity: number) {
    setError(null);
    setPendingId(itemId);
    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("quantity", String(quantity));
    startTransition(async () => {
      const result = await updateAction(formData);
      setPendingId(null);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function handleRemove(itemId: string) {
    setError(null);
    setPendingId(itemId);
    const formData = new FormData();
    formData.set("itemId", itemId);
    startTransition(async () => {
      const result = await removeAction(formData);
      setPendingId(null);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitAction();
      if (result.ok) router.push("/portal/pedidos");
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium"></th>
              <th className="px-4 py-2.5 font-medium">Produto</th>
              <th className="px-4 py-2.5 font-medium text-right">Quantidade</th>
              <th className="px-4 py-2.5 font-medium text-right">Preço unitário</th>
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2.5">
                  <div className="relative h-10 w-10 overflow-hidden rounded-[var(--radius-sm)] border border-border-subtle bg-surface-muted">
                    {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-cover" unoptimized /> : null}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-tabular text-[12px] text-text-muted">{item.sku}</p>
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.discountSource !== "NONE" ? (
                    <Badge tone={item.discountSource === "OFFER" ? "danger" : "brand"}>
                      {item.discountSource === "OFFER" ? "Oferta" : "Desconto por quantidade"}
                    </Badge>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input
                    type="number"
                    min={item.minCommercialQuantity}
                    defaultValue={item.quantity}
                    disabled={isPending && pendingId === item.id}
                    onBlur={(e) => {
                      const next = Number(e.target.value);
                      if (next > 0 && next !== item.quantity) handleUpdate(item.id, next);
                    }}
                    className="h-8 w-20 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 text-right text-[13px]"
                  />
                  <p className="mt-0.5 text-[11px] text-text-faint">{item.unit}</p>
                </td>
                <td className="px-4 py-2.5 text-right font-tabular">{formatCurrency(item.unitPrice)}</td>
                <td className="px-4 py-2.5 text-right font-tabular font-medium">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={isPending && pendingId === item.id}
                    className="text-[12px] text-danger-600 hover:underline"
                  >
                    {pendingId === item.id ? "…" : "Remover"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-1 text-[13px]">
        <p className="text-text-muted">
          Preço de tabela: <span className="font-tabular">{formatCurrency(listSubtotal)}</span>
        </p>
        {savings > 0 ? (
          <p className="text-success-600">
            Economia: <span className="font-tabular font-semibold">{formatCurrency(savings)}</span>
          </p>
        ) : null}
        <p className="text-lg font-semibold text-foreground">
          Total: <span className="font-tabular">{formatCurrency(subtotal)}</span>
        </p>
        <Button onClick={handleSubmit} disabled={isPending || items.length === 0} className="mt-2">
          {isPending ? "Enviando…" : "Finalizar pedido"}
        </Button>
      </div>
    </div>
  );
}
