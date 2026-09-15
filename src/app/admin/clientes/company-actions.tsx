"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveCustomerCompany, blockCustomerCompany, reviewCustomerCompany } from "./actions";

export function CompanyActions({
  companyId,
  status,
  reviewedById,
  currentUserId,
}: {
  companyId: string;
  status: string;
  reviewedById: string | null;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action(companyId);
      setError(result.ok ? null : result.error ?? "Falha ao atualizar.");
    });
  }

  const isPending_ = status === "PENDING_VALIDATION";
  const reviewedByOther = !!reviewedById && reviewedById !== currentUserId;
  const reviewedBySelf = !!reviewedById && reviewedById === currentUserId;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        {isPending_ && !reviewedById ? (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(reviewCustomerCompany)}>
            Revisar
          </Button>
        ) : null}
        {isPending_ && reviewedById ? (
          <Button
            size="sm"
            variant="primary"
            disabled={isPending || !reviewedByOther}
            onClick={() => run(approveCustomerCompany)}
            title={reviewedBySelf ? "Outro administrador precisa aprovar após a sua revisão" : undefined}
          >
            Aprovar (2ª etapa)
          </Button>
        ) : null}
        {status !== "BLOCKED" ? (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(blockCustomerCompany)}>
            Bloquear
          </Button>
        ) : null}
      </div>
      {error ? <span className="text-[11px] text-danger-600">{error}</span> : null}
      {isPending_ && reviewedBySelf ? (
        <span className="text-[11px] text-text-muted">
          Revisado por você — outro administrador precisa aprovar (§12/§26).
        </span>
      ) : null}
    </div>
  );
}
