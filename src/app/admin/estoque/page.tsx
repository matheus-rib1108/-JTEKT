import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Estoque — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Estoque"
      phaseLabel="Fase 2"
      description="Visão em tempo real de quantidades, giro e cobertura por produto, com classificação ABC/XYZ e prioridade de redução calculadas pelo Smart Stock Engine."
    />
  );
}
