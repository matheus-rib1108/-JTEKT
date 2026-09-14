"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { QuoteStatus } from "@prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

export function QuoteActions({
  quoteId,
  status,
  acceptAction,
  rejectAction,
  cancelAction,
}: {
  quoteId: string;
  status: QuoteStatus;
  acceptAction: (formData: FormData) => Promise<ActionResult>;
  rejectAction: (formData: FormData) => Promise<ActionResult>;
  cancelAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (formData: FormData) => Promise<ActionResult>) {
    setError(null);
    const formData = new FormData();
    formData.set("quoteId", quoteId);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {status === "PROPOSED" ? (
          <>
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(acceptAction)}>
              Aceitar
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(rejectAction)}>
              Rejeitar
            </Button>
          </>
        ) : null}
        {status === "REQUESTED" ? (
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(cancelAction)}>
            Cancelar solicitação
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className="max-w-xs">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
