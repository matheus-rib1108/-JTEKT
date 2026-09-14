import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Posições — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Posições"
      phaseLabel="Fase 3"
      description="Endereçamento detalhado (Galpão-Corredor-Rack-Nível-Posição) e o indicador de progresso das 580 posições fora do padrão."
    />
  );
}
