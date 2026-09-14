import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Logística — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.LOGISTICS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Logística"
      phaseLabel="Fase 9"
      description="Status de separação, conferência, embalagem, expedição e entrega de cada pedido."
    />
  );
}
