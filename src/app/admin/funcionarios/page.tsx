import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Funcionários — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Funcionários"
      phaseLabel="Fase futura"
      description="Dados operacionais de RH (turnos, produtividade, escala) — distinto do cadastro de contas de acesso em Usuários."
    />
  );
}
