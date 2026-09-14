"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createWarehouse } from "./actions";

export function WarehouseForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createWarehouse(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="code">Código</Label>
        <Input id="code" name="code" required placeholder="A" className="font-tabular" maxLength={10} />
      </div>
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required placeholder="Galpão A" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando…" : "Criar galpão"}
      </Button>
      {error ? (
        <div className="sm:col-span-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
