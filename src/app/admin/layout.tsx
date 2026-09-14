import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/rbac";
import { AdminShellChrome } from "@/components/layout/admin-shell-chrome";
import type { PermissionKey } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/admin/dashboard");
  }

  // Internal-only area: client (customer) users belong in /portal, never here,
  // even if they somehow held a valid session cookie.
  if (user.userType !== "INTERNAL") {
    redirect("/portal");
  }

  return (
    <AdminShellChrome
      user={{ name: user.name, email: user.email, roleKey: user.roleKey }}
      permissions={Array.from(user.permissions) as PermissionKey[]}
    >
      {children}
    </AdminShellChrome>
  );
}
