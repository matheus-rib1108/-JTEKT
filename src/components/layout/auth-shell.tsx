import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-950">
      <div className="border-b border-white/10 px-6 py-5">
        <Link href="/" className="inline-flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            StockFlow<span className="text-accent-500">B2B</span>
          </span>
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-[var(--radius-md)] border border-border-subtle bg-surface p-7 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <h1 className="text-[17px] font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-[13px] text-text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-5 border-t border-border-subtle pt-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
