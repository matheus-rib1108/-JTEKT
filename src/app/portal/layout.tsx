import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { PortalShellChrome } from "@/components/layout/portal-shell-chrome";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/portal");
  }

  if (user.userType !== "CLIENT") {
    redirect("/admin/dashboard");
  }

  const company = user.customerCompanyId
    ? await prisma.customerCompany.findUnique({ where: { id: user.customerCompanyId } })
    : null;

  return (
    <PortalShellChrome companyName={company?.legalName ?? "Empresa"} userName={user.name}>
      {children}
    </PortalShellChrome>
  );
}
