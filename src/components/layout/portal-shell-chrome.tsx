"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PORTAL_NAV } from "@/components/layout/portal-nav-items";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getCsrfTokenFromCookie } from "@/lib/csrf-client";

export function PortalShellChrome({
  companyName,
  userName,
  children,
}: {
  companyName: string;
  userName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() ?? "" },
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="text-[15px] font-semibold tracking-tight text-brand-900">
              StockFlow<span className="text-accent-600">B2B</span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {PORTAL_NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px]",
                      active ? "bg-brand-50 font-medium text-brand-800" : "text-text-muted hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium text-foreground">{userName}</p>
              <p className="text-[11px] text-text-muted">{companyName}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sair
            </Button>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-[var(--radius-sm)] border border-border-strong px-2 py-1 text-[13px] lg:hidden"
            >
              Menu
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <nav className="flex flex-col gap-0.5 border-t border-border-subtle px-4 py-2 lg:hidden">
            {PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-[var(--radius-sm)] px-2 py-2 text-[13px] text-foreground hover:bg-surface-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
