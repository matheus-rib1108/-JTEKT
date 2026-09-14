import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function EmptyState({
  title,
  description,
  phaseLabel,
  action,
}: {
  title: string;
  description: string;
  phaseLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-muted/60 px-6 py-10">
      {phaseLabel ? <Badge tone="brand">{phaseLabel}</Badge> : null}
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-[13px] text-text-muted">{description}</p>
      {action}
    </div>
  );
}
