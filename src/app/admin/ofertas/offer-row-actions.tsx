"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { OfferStatus } from "@prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

export function OfferRowActions({
  offerId,
  status,
  canApprove,
  canManage,
  activateAction,
  pauseAction,
  endAction,
}: {
  offerId: string;
  status: OfferStatus;
  canApprove: boolean;
  canManage: boolean;
  activateAction: (formData: FormData) => Promise<ActionResult>;
  pauseAction: (formData: FormData) => Promise<ActionResult>;
  endAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (formData: FormData) => Promise<ActionResult>) {
    setError(null);
    const formData = new FormData();
    formData.set("offerId", offerId);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {(status === "DRAFT" || status === "PAUSED") && canApprove ? (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(activateAction)}>
            Ativar
          </Button>
        ) : null}
        {status === "ACTIVE" && canManage ? (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(pauseAction)}>
            Pausar
          </Button>
        ) : null}
        {status !== "ENDED" && canManage ? (
          <Button size="sm" variant="danger" disabled={isPending} onClick={() => run(endAction)}>
            Encerrar
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
