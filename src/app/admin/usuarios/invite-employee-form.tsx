"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { inviteEmployee } from "./actions";

export function InviteEmployeeForm({ roles }: { roles: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(
    null,
  );

  function handleSubmit(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const result = await inviteEmployee(formData);
      if (result.ok) {
        setFeedback({ tone: "success", message: "Convite criado. O acesso é ativado ao definir a senha." });
        formRef.current?.reset();
      } else {
        setFeedback({ tone: "danger", message: result.error });
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="email">E-mail corporativo</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="roleId">Função</Label>
        <select
          id="roleId"
          name="roleId"
          required
          className="h-10 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Convidando…" : "Convidar"}
      </Button>
      {feedback ? (
        <div className="sm:col-span-4">
          <Alert tone={feedback.tone}>{feedback.message}</Alert>
        </div>
      ) : null}
    </form>
  );
}
