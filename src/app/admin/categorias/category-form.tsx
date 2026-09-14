"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createCategory } from "./actions";

export function CategoryForm({ categories }: { categories: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCategory(formData);
      if (result.ok) {
        formRef.current?.reset();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required placeholder="Ex.: Rolamentos" />
      </div>
      <div>
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Input id="description" name="description" />
      </div>
      <div>
        <Label htmlFor="parentId">Categoria pai (opcional)</Label>
        <select
          id="parentId"
          name="parentId"
          className="h-10 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
        >
          <option value="">— Nenhuma —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Adicionar"}
      </Button>
      {error ? (
        <div className="sm:col-span-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
