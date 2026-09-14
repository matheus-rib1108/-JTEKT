"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { recomputeSmartStockEngine } from "./actions";

export function RecomputeButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      const result = await recomputeSmartStockEngine();
      if (result.ok) {
        setFeedback({ tone: "success", message: result.message });
        router.refresh();
      } else {
        setFeedback({ tone: "danger", message: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="secondary" size="sm" disabled={isPending} onClick={handleClick}>
        {isPending ? "Recalculando…" : "Recalcular classificação e alertas"}
      </Button>
      {feedback ? (
        <div className="max-w-sm text-right">
          <Alert tone={feedback.tone}>{feedback.message}</Alert>
        </div>
      ) : null}
    </div>
  );
}
