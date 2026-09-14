"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { updatePriorityWeights } from "./actions";
import type { PriorityWeights } from "@/lib/stockClassification";

export function WeightsForm({ current }: { current: PriorityWeights }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePriorityWeights(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="coverage">Cobertura (dias de estoque)</Label>
          <Input id="coverage" name="coverage" type="number" min={0} max={100} defaultValue={current.coverage} />
        </div>
        <div>
          <Label htmlFor="idle">Tempo sem movimentação</Label>
          <Input id="idle" name="idle" type="number" min={0} max={100} defaultValue={current.idle} />
        </div>
        <div>
          <Label htmlFor="space">Espaço ocupado</Label>
          <Input id="space" name="space" type="number" min={0} max={100} defaultValue={current.space} />
        </div>
        <div>
          <Label htmlFor="value">Valor parado</Label>
          <Input id="value" name="value" type="number" min={0} max={100} defaultValue={current.value} />
        </div>
      </div>
      <p className="text-[11px] text-text-faint">
        Pesos relativos — não precisam somar 100, são normalizados automaticamente no cálculo.
      </p>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar pesos"}
      </Button>
    </form>
  );
}
