"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { changeLocationStatus, toggleNonStandard } from "./actions";

export interface MapLocation {
  id: string;
  code: string;
  area: string | null;
  corridor: string;
  rack: string;
  level: string;
  position: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BLOCKED";
  isNonStandard: boolean;
  allocations: { productName: string; productSku: string; quantity: number }[];
}

const STATUS_STYLES: Record<MapLocation["status"], string> = {
  AVAILABLE: "bg-surface border-border-strong text-text-muted",
  OCCUPIED: "bg-brand-100 border-brand-500 text-brand-800",
  RESERVED: "bg-warning-100 border-warning-600 text-warning-700",
  BLOCKED: "bg-danger-100 border-danger-600 text-danger-600",
};

const STATUS_LABEL: Record<MapLocation["status"], string> = {
  AVAILABLE: "Disponível",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
  BLOCKED: "Bloqueada",
};

export function WarehouseMap({ locations, canManage }: { locations: MapLocation[]; canManage: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, MapLocation[]>();
    for (const loc of locations) {
      const key = `${loc.corridor}-${loc.rack}`;
      map.set(key, [...(map.get(key) ?? []), loc]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({
        key,
        corridor: items[0].corridor,
        rack: items[0].rack,
        items: items.sort((a, b) => a.level.localeCompare(b.level) || a.position.localeCompare(b.position)),
      }));
  }, [locations]);

  const selected = locations.find((l) => l.id === selectedId) ?? null;

  function runStatusChange(status: string) {
    if (!selected) return;
    setError(null);
    const formData = new FormData();
    formData.set("storageLocationId", selected.id);
    formData.set("status", status);
    startTransition(async () => {
      const result = await changeLocationStatus(formData);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function runToggleNonStandard() {
    if (!selected) return;
    setError(null);
    const formData = new FormData();
    formData.set("storageLocationId", selected.id);
    formData.set("isNonStandard", String(!selected.isNonStandard));
    startTransition(async () => {
      const result = await toggleNonStandard(formData);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (locations.length === 0) {
    return (
      <p className="text-[13px] text-text-muted">
        Nenhuma posição cadastrada neste galpão ainda. Use o gerador de posições abaixo.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="mb-1.5 text-[12px] font-medium text-text-muted">
              Corredor {group.corridor} · Rack {group.rack}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelectedId(loc.id)}
                  title={loc.code}
                  className={cn(
                    "relative h-9 w-16 rounded-[var(--radius-sm)] border text-[11px] font-tabular transition-transform",
                    STATUS_STYLES[loc.status],
                    selectedId === loc.id && "ring-2 ring-brand-600 ring-offset-1",
                    loc.isNonStandard && "outline outline-2 outline-offset-1 outline-accent-500",
                  )}
                >
                  {loc.level}
                  {loc.position}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-[12px] text-text-muted">
        <LegendItem swatchClass="bg-surface border-border-strong" label="Disponível" />
        <LegendItem swatchClass="bg-brand-100 border-brand-500" label="Ocupada" />
        <LegendItem swatchClass="bg-warning-100 border-warning-600" label="Reservada" />
        <LegendItem swatchClass="bg-danger-100 border-danger-600" label="Bloqueada" />
        <LegendItem swatchClass="bg-surface border-border-strong outline outline-2 outline-accent-500" label="Fora do padrão" />
      </div>

      {selected ? (
        <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-muted/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-tabular text-[14px] font-semibold text-foreground">{selected.code}</p>
              <p className="text-[12px] text-text-muted">{selected.area || "Sem área descritiva"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={selected.status === "OCCUPIED" ? "brand" : "neutral"}>{STATUS_LABEL[selected.status]}</Badge>
              {selected.isNonStandard ? <Badge tone="warning">Fora do padrão</Badge> : null}
            </div>
          </div>

          {selected.allocations.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-border-subtle pt-3 text-[13px]">
              {selected.allocations.map((a) => (
                <li key={a.productSku} className="flex justify-between">
                  <span className="text-text-muted">
                    {a.productSku} · {a.productName}
                  </span>
                  <span className="font-tabular font-medium text-foreground">{a.quantity} un.</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border-t border-border-subtle pt-3 text-[12px] text-text-faint">
              Nenhum produto alocado nesta posição.
            </p>
          )}

          {canManage ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
              {error ? <span className="text-[12px] text-danger-600">{error}</span> : null}
              <span className="text-[12px] text-text-muted">Status:</span>
              {(["AVAILABLE", "RESERVED", "BLOCKED"] as const).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={selected.status === status ? "primary" : "outline"}
                  disabled={isPending}
                  onClick={() => runStatusChange(status)}
                >
                  {STATUS_LABEL[status]}
                </Button>
              ))}
              <Button size="sm" variant="ghost" disabled={isPending} onClick={runToggleNonStandard}>
                {selected.isNonStandard ? "Marcar como corrigida" : "Marcar como fora do padrão"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-text-faint">Clique em uma posição para ver detalhes.</p>
      )}
    </div>
  );
}

function LegendItem({ swatchClass, label }: { swatchClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-[3px] border", swatchClass)} />
      {label}
    </span>
  );
}
