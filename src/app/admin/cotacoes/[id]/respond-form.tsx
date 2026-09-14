"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type ActionResult = { ok: true } | { ok: false; error: string };

export function RespondForm({
  quoteId,
  minPrice,
  action,
}: {
  quoteId: string;
  minPrice: number | null;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const priceNum = Number(price.replace(",", "."));
  const belowFloor = minPrice !== null && !Number.isNaN(priceNum) && price !== "" && priceNum < minPrice;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="quoteId" value={quoteId} />
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div>
        <Label htmlFor="proposedUnitPrice">Preço unitário proposto (R$)</Label>
        <Input
          id="proposedUnitPrice"
          name="proposedUnitPrice"
          type="number"
          min={0.01}
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        {minPrice !== null ? (
          <p className="mt-1 text-[11px] text-text-faint">Preço mínimo configurado: R$ {minPrice.toFixed(2)}.</p>
        ) : null}
      </div>

      {belowFloor ? (
        <Alert tone="danger">
          Esse valor fica abaixo do preço mínimo configurado — não pode ser enviado. Ajuste o
          preço mínimo do produto em Preços primeiro, se necessário.
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="responseMessage">Mensagem para o cliente (opcional)</Label>
        <textarea
          id="responseMessage"
          name="responseMessage"
          rows={3}
          className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm"
        />
      </div>

      <Button type="submit" disabled={isPending || belowFloor}>
        {isPending ? "Enviando…" : "Enviar proposta"}
      </Button>
    </form>
  );
}
