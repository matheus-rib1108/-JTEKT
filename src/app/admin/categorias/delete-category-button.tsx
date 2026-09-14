"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteCategory } from "./actions";

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCategory(categoryId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? <span className="text-[11px] text-danger-600">{error}</span> : null}
      <Button size="sm" variant="ghost" disabled={isPending} onClick={handleClick}>
        Remover
      </Button>
    </div>
  );
}
