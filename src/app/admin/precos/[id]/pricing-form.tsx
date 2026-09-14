"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type ActionResult = { ok: true } | { ok: false; error: string };

export function PricingForm({
  productId,
  initialListPrice,
  initialMinPrice,
  canException,
  action,
}: {
  productId: string;
  initialListPrice: string;
  initialMinPrice: string;
  canException: boolean;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [listPrice, setListPrice] = useState(initialListPrice);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [exceptionReason, setExceptionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const listPriceNum = Number(listPrice.replace(",", "."));
  const minPriceNum = minPrice ? Number(minPrice.replace(",", ".")) : null;
  const isException = minPriceNum !== null && !Number.isNaN(listPriceNum) && listPriceNum < minPriceNum;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="listPrice">Preço de lista (R$)</Label>
          <Input
            id="listPrice"
            name="listPrice"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="minPrice">Preço mínimo (R$, opcional)</Label>
          <Input
            id="minPrice"
            name="minPrice"
            type="number"
            min={0}
            step="0.01"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-text-faint">
            Nenhuma venda ou oferta pode ficar abaixo disso sem aprovação explícita.
          </p>
        </div>
      </div>

      {isException ? (
        canException ? (
          <div>
            <Alert tone="warning">
              O preço de lista informado fica abaixo do preço mínimo configurado. Salvar isso é uma
              exceção — informe o motivo; a ação fica registrada na auditoria.
            </Alert>
            <div className="mt-2">
              <Label htmlFor="exceptionReason">Motivo da exceção</Label>
              <textarea
                id="exceptionReason"
                name="exceptionReason"
                rows={2}
                required
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <Alert tone="danger">
            O preço de lista informado fica abaixo do preço mínimo configurado. Apenas um usuário com
            permissão de exceção pode salvar este valor.
          </Alert>
        )
      ) : null}

      <Button type="submit" disabled={isPending || (isException && !canException)}>
        {isPending ? "Salvando…" : "Salvar preço"}
      </Button>
    </form>
  );
}
