"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type ActionResult = { ok: true } | { ok: false; error: string };

export function AddToCartForm({
  productId,
  unit,
  minCommercialQuantity,
  maxQuantity,
  action,
}: {
  productId: string;
  unit: string;
  minCommercialQuantity: number;
  maxQuantity: number;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(minCommercialQuantity);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="productId" value={productId} />
      <div>
        <Label htmlFor="quantity">Quantidade ({unit})</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={minCommercialQuantity}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-28"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adicionando…" : "Adicionar ao carrinho"}
      </Button>
      {success ? <span className="text-[13px] text-success-600">Adicionado ao carrinho.</span> : null}
      {error ? (
        <div className="w-full">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
