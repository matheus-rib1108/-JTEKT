import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Relatórios — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Relatórios"
      phaseLabel="Fase 11"
      description="Exportação de relatórios de estoque, vendas, ABC/XYZ, posições e movimentações em CSV/Excel/PDF."
    />
  );
}
