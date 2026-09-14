import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Central de alertas — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.ALERTS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Central de alertas"
      phaseLabel="Fase 4"
      description="Alertas automáticos de estoque acima do limite, sem movimentação, margem abaixo do permitido e pedidos pendentes de aprovação."
    />
  );
}
