import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Pedidos — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.ORDERS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Pedidos"
      phaseLabel="Fase 7"
      description="Pedidos B2B do carrinho até a expedição, com status de pagamento e reserva de estoque."
    />
  );
}
