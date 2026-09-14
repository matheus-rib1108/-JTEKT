"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type ActionResult = { ok: true } | { ok: false; error: string };

export interface EligibleProduct {
  id: string;
  sku: string;
  name: string;
  listPrice: number;
  minPrice: number | null;
  quantityOnHand: number;
}

export function OfferForm({
  products,
  action,
}: {
  products: EligibleProduct[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = products.find((p) => p.id === productId);
  const discountNum = Number(discountPercent);
  const resultingPrice =
    selected && !Number.isNaN(discountNum) ? selected.listPrice * (1 - discountNum / 100) : null;
  const belowFloor = selected?.minPrice != null && resultingPrice != null && resultingPrice < selected.minPrice;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (products.length === 0) {
    return (
      <p className="text-[13px] text-text-muted">
        Nenhum produto disponível: configure o preço de lista de um produto e garanta que ele não
        tenha outra oferta em andamento.
      </p>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div>
        <Label htmlFor="productId">Produto</Label>
        <select
          id="productId"
          name="productId"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="h-10 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name} ({p.quantityOnHand} un. em mãos)
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="discountPercent">Desconto (%)</Label>
          <Input
            id="discountPercent"
            name="discountPercent"
            type="number"
            min={0.01}
            max={90}
            step="0.01"
            required
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="targetReduceQuantity">Meta de redução (un.)</Label>
          <Input id="targetReduceQuantity" name="targetReduceQuantity" type="number" min={1} required />
        </div>
      </div>

      {selected && resultingPrice != null ? (
        <p className="text-[12px] text-text-muted">
          Preço resultante:{" "}
          <span className={belowFloor ? "font-semibold text-danger-600" : "font-medium text-foreground"}>
            {resultingPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          {belowFloor ? " — abaixo do preço mínimo configurado, será bloqueado ao salvar." : null}
        </p>
      ) : null}

      <div>
        <Label htmlFor="internalReason">Motivo interno (opcional, nunca exibido ao cliente)</Label>
        <textarea
          id="internalReason"
          name="internalReason"
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm"
        />
      </div>

      <Button type="submit" disabled={isPending || belowFloor}>
        {isPending ? "Criando…" : "Criar oferta (rascunho)"}
      </Button>
    </form>
  );
}
