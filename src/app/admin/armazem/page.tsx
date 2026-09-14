import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Armazém — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Armazém"
      phaseLabel="Fase 3"
      description="Mapa visual do galpão com áreas, corredores, racks e níveis — ocupação, capacidade e posições fora do padrão."
    />
  );
}
