import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Ofertas de estoque — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.OFFERS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Ofertas de estoque"
      phaseLabel="Fase 6"
      description="Ofertas comerciais geradas para reduzir excedentes, respeitando margem mínima e preço mínimo configurados por produto."
    />
  );
}
