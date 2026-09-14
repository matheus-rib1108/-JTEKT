"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { inviteClientUser } from "./actions";

export function InviteUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(
    null,
  );

  function handleSubmit(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const result = await inviteClientUser(formData);
      if (result.ok) {
        setFeedback({ tone: "success", message: "Convite enviado." });
        formRef.current?.reset();
      } else {
        setFeedback({ tone: "danger", message: result.error });
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Convidando…" : "Convidar"}
      </Button>
      {feedback ? (
        <div className="sm:col-span-3">
          <Alert tone={feedback.tone}>{feedback.message}</Alert>
        </div>
      ) : null}
    </form>
  );
}
