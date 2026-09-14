"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveCustomerCompany, blockCustomerCompany } from "./actions";

export function CompanyActions({ companyId, status }: { companyId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action(companyId);
      setError(result.ok ? null : result.error ?? "Falha ao atualizar.");
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? <span className="text-[11px] text-danger-600">{error}</span> : null}
      {status !== "ACTIVE" ? (
        <Button size="sm" variant="primary" disabled={isPending} onClick={() => run(approveCustomerCompany)}>
          Aprovar
        </Button>
      ) : null}
      {status !== "BLOCKED" ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(blockCustomerCompany)}>
          Bloquear
        </Button>
      ) : null}
    </div>
  );
}
