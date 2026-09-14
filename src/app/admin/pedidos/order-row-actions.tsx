"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { OrderStatus } from "@prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

export function OrderRowActions({
  orderId,
  status,
  canManage,
  confirmAction,
  cancelAction,
}: {
  orderId: string;
  status: OrderStatus;
  canManage: boolean;
  confirmAction: (formData: FormData) => Promise<ActionResult>;
  cancelAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    startTransition(async () => {
      const result = await confirmAction(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function handleCancel() {
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("reason", reason);
    startTransition(async () => {
      const result = await cancelAction(formData);
      if (result.ok) {
        setShowCancelForm(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!canManage) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {status === "SUBMITTED" ? (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={handleConfirm}>
            Confirmar
          </Button>
        ) : null}
        {(status === "SUBMITTED" || status === "CONFIRMED") ? (
          <Button size="sm" variant="danger" disabled={isPending} onClick={() => setShowCancelForm((v) => !v)}>
            Cancelar
          </Button>
        ) : null}
      </div>
      {showCancelForm ? (
        <div className="w-64 space-y-1.5">
          <textarea
            placeholder="Motivo do cancelamento (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 py-1 text-[12px]"
          />
          <Button size="sm" variant="danger" disabled={isPending} onClick={handleCancel} className="w-full">
            {isPending ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </div>
      ) : null}
      {error ? (
        <div className="max-w-xs">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
