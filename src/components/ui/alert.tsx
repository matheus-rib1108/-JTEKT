import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "danger" | "success" | "warning" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  danger: "border-danger-600/30 bg-danger-100 text-danger-600",
  success: "border-success-600/30 bg-success-100 text-success-600",
  warning: "border-warning-600/30 bg-warning-100 text-warning-700",
  brand: "border-brand-500/30 bg-brand-50 text-brand-800",
};

export function Alert({ tone = "brand", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={cn("rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-[13px]", TONE_CLASSES[tone])}>
      {children}
    </div>
  );
}
