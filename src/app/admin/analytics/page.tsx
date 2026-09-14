import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Analytics — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.ANALYTICS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Analytics"
      phaseLabel="Fase 10"
      description="Gráficos de giro, valor parado, evolução mensal, espaço liberado e margem — base para o dashboard executivo."
    />
  );
}
