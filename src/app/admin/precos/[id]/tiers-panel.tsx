"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type ActionResult = { ok: true } | { ok: false; error: string };

export interface TierItem {
  id: string;
  minQuantity: number;
  discountPercent: number;
}

export function TiersPanel({
  productId,
  tiers,
  addAction,
  removeAction,
}: {
  productId: string;
  tiers: TierItem[];
  addAction: (formData: FormData) => Promise<ActionResult>;
  removeAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addAction(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemove(tierId: string) {
    setError(null);
    setRemovingId(tierId);
    const formData = new FormData();
    formData.set("tierId", tierId);
    startTransition(async () => {
      const result = await removeAction(formData);
      setRemovingId(null);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {sorted.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nenhuma faixa de desconto cadastrada ainda.</p>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-wide text-text-faint">
            <tr>
              <th className="py-1.5 font-medium">A partir de</th>
              <th className="py-1.5 font-medium text-right">Desconto</th>
              <th className="py-1.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sorted.map((tier) => (
              <tr key={tier.id}>
                <td className="py-1.5 font-tabular">{tier.minQuantity} un.</td>
                <td className="py-1.5 text-right font-tabular">{tier.discountPercent}%</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemove(tier.id)}
                    disabled={isPending && removingId === tier.id}
                    className="text-[12px] text-danger-600 hover:underline"
                  >
                    {removingId === tier.id ? "…" : "Remover"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form ref={formRef} action={handleAdd} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-border-subtle pt-3">
        <input type="hidden" name="productId" value={productId} />
        <div>
          <Label htmlFor="minQuantity">Quantidade mínima</Label>
          <Input id="minQuantity" name="minQuantity" type="number" min={1} required />
        </div>
        <div>
          <Label htmlFor="discountPercent">Desconto (%)</Label>
          <Input id="discountPercent" name="discountPercent" type="number" min={0} max={90} step="0.01" required />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" disabled={isPending}>
            Adicionar
          </Button>
        </div>
      </form>
    </div>
  );
}
