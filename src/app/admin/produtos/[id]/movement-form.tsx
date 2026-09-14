"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { registerProductMovement } from "../actions";

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRADA: "Entrada (recebimento)",
  SAIDA: "Saída (consumo/venda manual)",
  AJUSTE: "Ajuste manual (+/-)",
  RESERVA: "Reserva",
  LIBERACAO_RESERVA: "Liberação de reserva",
  BLOQUEIO: "Bloqueio (ex.: qualidade)",
  DESBLOQUEIO: "Desbloqueio",
};

export function MovementForm({ productId }: { productId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("ENTRADA");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await registerProductMovement(formData);
      if (result.ok) {
        formRef.current?.reset();
        setType("ENTRADA");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="type">Tipo</Label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
          >
            {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="quantity">Quantidade{type === "AJUSTE" ? " (+/-)" : ""}</Label>
          <Input id="quantity" name="quantity" type="number" required />
        </div>
        <div>
          <Label htmlFor="reason">Motivo (opcional)</Label>
          <Input id="reason" name="reason" />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Registrando…" : "Registrar movimento"}
      </Button>
    </form>
  );
}
