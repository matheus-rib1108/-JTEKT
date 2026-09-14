"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleNonStandard } from "../armazem/actions";

export function MarkCorrectedButton({ storageLocationId }: { storageLocationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    const formData = new FormData();
    formData.set("storageLocationId", storageLocationId);
    formData.set("isNonStandard", "false");
    startTransition(async () => {
      const result = await toggleNonStandard(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? <span className="text-[11px] text-danger-600">{error}</span> : null}
      <Button size="sm" variant="primary" disabled={isPending} onClick={handleClick}>
        Marcar como corrigida
      </Button>
    </div>
  );
}
