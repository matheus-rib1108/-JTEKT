"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveAlert } from "./actions";

export function ResolveButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    const formData = new FormData();
    formData.set("alertId", alertId);
    startTransition(async () => {
      const result = await resolveAlert(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? <span className="text-[11px] text-danger-600">{error}</span> : null}
      <Button size="sm" variant="outline" disabled={isPending} onClick={handleClick}>
        Resolver
      </Button>
    </div>
  );
}
