"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { setNonStandardBaseline } from "./actions";

export function BaselineForm({ currentCount }: { currentCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await setNonStandardBaseline(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="count">Total inicial de posições fora do padrão</Label>
        <Input id="count" name="count" type="number" min={0} required defaultValue={currentCount} className="w-40" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Definir meta"}
      </Button>
    </form>
  );
}
