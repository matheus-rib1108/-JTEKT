import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Motor de preços — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.PRICING_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Motor de preços"
      phaseLabel="Fase 6"
      description="Custo, margem mínima, preço mínimo, descontos por quantidade e fluxo de aprovação de exceções de desconto."
    />
  );
}
