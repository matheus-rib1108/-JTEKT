"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { allocateProductToLocation } from "../actions";

export function AllocationForm({
  productId,
  locations,
}: {
  productId: string;
  locations: { id: string; code: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await allocateProductToLocation(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (locations.length === 0) {
    return (
      <p className="text-[12px] text-text-faint">
        Nenhuma posição cadastrada ainda. Crie posições em Armazém antes de alocar este produto.
      </p>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <div>
          <Label htmlFor="storageLocationId">Posição</Label>
          <select
            id="storageLocationId"
            name="storageLocationId"
            required
            className="h-10 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm font-tabular"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="quantity">Quantidade</Label>
          <Input id="quantity" name="quantity" type="number" min={0} required />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Alocar"}
        </Button>
      </div>
      <p className="text-[11px] text-text-faint">Quantidade 0 remove a alocação nessa posição.</p>
    </form>
  );
}
