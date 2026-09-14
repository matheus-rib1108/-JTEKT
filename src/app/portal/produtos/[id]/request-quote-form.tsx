"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type ActionResult = { ok: true } | { ok: false; error: string };

export function RequestQuoteForm({
  productId,
  unit,
  minCommercialQuantity,
  action,
}: {
  productId: string;
  unit: string;
  minCommercialQuantity: number;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setSuccess(true);
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Solicitar cotação
        </Button>
        {success ? <p className="mt-1.5 text-[13px] text-success-600">Cotação solicitada — acompanhe em Cotações.</p> : null}
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-2 rounded-[var(--radius-sm)] border border-border-subtle p-3">
      <input type="hidden" name="productId" value={productId} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="quoteQuantity">Quantidade ({unit})</Label>
          <Input id="quoteQuantity" name="quantity" type="number" min={minCommercialQuantity} defaultValue={minCommercialQuantity} required />
        </div>
        <div>
          <Label htmlFor="requestedPrice">Preço desejado (R$, opcional)</Label>
          <Input id="requestedPrice" name="requestedPrice" type="number" min={0.01} step="0.01" />
        </div>
      </div>
      <div>
        <Label htmlFor="quoteMessage">Mensagem (opcional)</Label>
        <textarea
          id="quoteMessage"
          name="message"
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Enviando…" : "Enviar solicitação"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
