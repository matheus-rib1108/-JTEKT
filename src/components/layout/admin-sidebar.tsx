"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/components/layout/admin-nav-items";
import { cn } from "@/lib/cn";
import type { PermissionKey } from "@/lib/permissions";

export function AdminSidebar({ permissions }: { permissions: PermissionKey[] }) {
  const pathname = usePathname();
  const allowed = new Set(permissions);

  return (
    <aside className="hidden w-60 flex-col border-r border-white/10 bg-brand-950 px-3 py-5 lg:flex">
      <Link href="/admin/dashboard" className="mb-6 px-2 text-[15px] font-semibold tracking-tight text-white">
        StockFlow<span className="text-accent-500">B2B</span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {ADMIN_NAV.map((group) => {
          const visibleItems = group.items.filter((item) => allowed.has(item.permission));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {visibleItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span>{item.label}</span>
                      {item.phase ? (
                        <span className="text-[10px] font-medium text-white/35">{item.phase}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
