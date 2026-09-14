"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { generatePositions } from "./actions";

export function GeneratePositionsForm({ warehouseId }: { warehouseId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  function handleSubmit(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const result = await generatePositions(formData);
      if (result.ok) {
        setFeedback({ tone: "success", message: result.message ?? "Posições geradas." });
        formRef.current?.reset();
        router.refresh();
      } else {
        setFeedback({ tone: "danger", message: result.error });
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <input type="hidden" name="warehouseId" value={warehouseId} />
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <Label htmlFor="corridor">Corredor</Label>
          <Input id="corridor" name="corridor" required placeholder="03" className="font-tabular" />
        </div>
        <div>
          <Label htmlFor="rack">Rack/Estante</Label>
          <Input id="rack" name="rack" required placeholder="R12" className="font-tabular" />
        </div>
        <div>
          <Label htmlFor="levelCount">Níveis</Label>
          <Input id="levelCount" name="levelCount" type="number" min={1} max={50} required defaultValue={4} />
        </div>
        <div>
          <Label htmlFor="positionsPerLevel">Posições/nível</Label>
          <Input id="positionsPerLevel" name="positionsPerLevel" type="number" min={1} max={50} required defaultValue={8} />
        </div>
        <div>
          <Label htmlFor="area">Área (opcional)</Label>
          <Input id="area" name="area" placeholder="Rolamentos" />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Gerando…" : "Gerar posições"}
      </Button>
    </form>
  );
}
