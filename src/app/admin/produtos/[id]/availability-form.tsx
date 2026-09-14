"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { updateProductAvailability } from "../actions";

export function AvailabilityForm({
  productId,
  freeStock,
  initial,
}: {
  productId: string;
  freeStock: number;
  initial: {
    quantityAvailableToSell: number;
    reorderPoint: number | null;
    maxStock: number | null;
    safetyStock: number | null;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateProductAvailability(formData);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="text-[12px] text-text-faint">Estoque livre atual: {freeStock} un. (base para o limite abaixo)</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="quantityAvailableToSell">Disponível p/ venda</Label>
          <Input
            id="quantityAvailableToSell"
            name="quantityAvailableToSell"
            type="number"
            min={0}
            max={freeStock}
            defaultValue={initial.quantityAvailableToSell}
            required
          />
        </div>
        <div>
          <Label htmlFor="reorderPoint">Estoque mínimo</Label>
          <Input id="reorderPoint" name="reorderPoint" type="number" min={0} defaultValue={initial.reorderPoint ?? ""} />
        </div>
        <div>
          <Label htmlFor="maxStock">Estoque máximo</Label>
          <Input id="maxStock" name="maxStock" type="number" min={0} defaultValue={initial.maxStock ?? ""} />
        </div>
        <div>
          <Label htmlFor="safetyStock">Estoque de segurança</Label>
          <Input id="safetyStock" name="safetyStock" type="number" min={0} defaultValue={initial.safetyStock ?? ""} />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar disponibilidade"}
      </Button>
    </form>
  );
}
