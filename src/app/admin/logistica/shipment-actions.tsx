"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { ShipmentStatus } from "@prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

export function ShipmentActions({
  shipmentId,
  status,
  packAction,
  shipAction,
  deliverAction,
}: {
  shipmentId: string;
  status: ShipmentStatus;
  packAction: (formData: FormData) => Promise<ActionResult>;
  shipAction: (formData: FormData) => Promise<ActionResult>;
  deliverAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showShipForm, setShowShipForm] = useState(false);
  const [carrierName, setCarrierName] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: (formData: FormData) => Promise<ActionResult>, extra?: Record<string, string>) {
    setError(null);
    const formData = new FormData();
    formData.set("shipmentId", shipmentId);
    if (extra) for (const [k, v] of Object.entries(extra)) formData.set(k, v);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setShowShipForm(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {status === "PICKING" ? (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(packAction)}>
            Marcar embalado
          </Button>
        ) : null}
        {status === "PACKED" ? (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setShowShipForm((v) => !v)}>
            Despachar
          </Button>
        ) : null}
        {status === "SHIPPED" ? (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(deliverAction)}>
            Marcar entregue
          </Button>
        ) : null}
      </div>
      {showShipForm ? (
        <div className="w-56 space-y-1.5">
          <Input placeholder="Transportadora (opcional)" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
          <Input placeholder="Código de rastreio (opcional)" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} />
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(shipAction, { carrierName, trackingCode })}
            className="w-full"
          >
            {isPending ? "Despachando…" : "Confirmar despacho"}
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
