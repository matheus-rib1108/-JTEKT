"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type ActionResult = { ok: true } | { ok: false; error: string };
type EnrollmentResult =
  | { ok: true; secretBase32: string; qrCodeDataUrl: string; manualEntryKey: string }
  | { ok: false; error: string };

export function MfaPanel({
  mfaEnabled,
  startAction,
  confirmAction,
  disableAction,
}: {
  mfaEnabled: boolean;
  startAction: () => Promise<EnrollmentResult>;
  confirmAction: (formData: FormData) => Promise<ActionResult>;
  disableAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<{ secretBase32: string; qrCodeDataUrl: string; manualEntryKey: string } | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startAction();
      if (result.ok) setEnrollment(result);
      else setError(result.error);
    });
  }

  function handleConfirm(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await confirmAction(formData);
      if (result.ok) {
        setEnrollment(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDisable(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await disableAction(formData);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  if (mfaEnabled) {
    return (
      <div className="space-y-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p className="text-[13px] text-success-600">Autenticação em duas etapas ativada.</p>
        <form action={handleDisable} className="flex items-end gap-2">
          <div>
            <Label htmlFor="disableCode">Código do app para desativar</Label>
            <Input
              id="disableCode"
              name="code"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="w-32"
            />
          </div>
          <Button type="submit" variant="danger" disabled={isPending}>
            {isPending ? "Desativando…" : "Desativar"}
          </Button>
        </form>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p className="text-[13px] text-text-muted">
          Adicione uma segunda etapa de verificação (código de 6 dígitos de um app autenticador)
          ao entrar.
        </p>
        <Button onClick={handleStart} disabled={isPending}>
          {isPending ? "Gerando…" : "Ativar autenticação em duas etapas"}
        </Button>
      </div>
    );
  }

  return (
    <form action={handleConfirm} className="space-y-3">
      <input type="hidden" name="secretBase32" value={enrollment.secretBase32} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="text-[13px] text-text-muted">
        Escaneie o QR code com um app autenticador (Google Authenticator, Authy...) ou informe a
        chave manualmente.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from server-generated QR, next/image adds no value here */}
      <img src={enrollment.qrCodeDataUrl} alt="QR code para configurar autenticação em duas etapas" width={200} height={200} />
      <p className="font-tabular text-[12px] text-text-muted">Chave manual: {enrollment.manualEntryKey}</p>
      <div>
        <Label htmlFor="mfaCode">Código de 6 dígitos</Label>
        <Input
          id="mfaCode"
          name="code"
          inputMode="numeric"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-32"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Confirmando…" : "Confirmar e ativar"}
      </Button>
    </form>
  );
}
