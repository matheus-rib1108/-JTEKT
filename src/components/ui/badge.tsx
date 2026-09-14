import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-text-muted",
  success: "bg-success-100 text-success-600",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-600",
  brand: "bg-brand-100 text-brand-800",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-[12px] font-medium uppercase tracking-wide",
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}
