import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Integrações — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.INTEGRATIONS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Integrações"
      phaseLabel="Fase futura"
      description="Conectores desacoplados para ERP, WMS, Power BI, gateways de pagamento e transportadoras."
    />
  );
}
