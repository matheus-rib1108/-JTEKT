"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV } from "@/components/layout/admin-nav-items";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getCsrfTokenFromCookie } from "@/lib/csrf-client";
import type { PermissionKey } from "@/lib/permissions";

interface CurrentUserSummary {
  name: string;
  email: string;
  roleKey: string;
}

export function AdminShellChrome({
  user,
  permissions,
  children,
}: {
  user: CurrentUserSummary;
  permissions: PermissionKey[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const allowed = new Set(permissions);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() ?? "" },
    });
    router.push("/login");
    router.refresh();
  }

  const currentPageLabel =
    ADMIN_NAV.flatMap((g) => g.items).find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? "Painel administrativo";

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar permissions={permissions} />

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-72 overflow-y-auto bg-brand-950 px-3 py-5">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-[15px] font-semibold text-white">
                StockFlow<span className="text-accent-500">B2B</span>
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-[13px] text-white/70"
                aria-label="Fechar menu"
              >
                Fechar
              </button>
            </div>
            {ADMIN_NAV.map((group) => {
              const visible = group.items.filter((i) => allowed.has(i.permission));
              if (visible.length === 0) return null;
              return (
                <div key={group.label} className="mb-4">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    {group.label}
                  </p>
                  <div className="mt-1.5 space-y-0.5">
                    {visible.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] text-white/80 hover:bg-white/5"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-[var(--radius-sm)] border border-border-strong px-2 py-1 text-[13px] lg:hidden"
            >
              Menu
            </button>
            <h1 className="text-[14px] font-medium text-foreground">{currentPageLabel}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/conta"
              className="hidden text-right sm:block hover:opacity-80"
            >
              <p className="text-[13px] font-medium text-foreground">{user.name}</p>
              <p className="text-[11px] text-text-muted">{user.roleKey}</p>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </header>
        <main className={cn("flex-1 px-4 py-6 lg:px-6")}>{children}</main>
      </div>
    </div>
  );
}
