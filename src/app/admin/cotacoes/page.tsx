import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Cotações — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.QUOTES_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Cotações"
      phaseLabel="Fase 8"
      description="Solicitações de cotação do cliente e propostas comerciais (preço, quantidade, prazo, frete) até aprovação ou recusa."
    />
  );
}
