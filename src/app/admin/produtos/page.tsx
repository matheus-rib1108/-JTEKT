import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Produtos — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Produtos"
      phaseLabel="Fase 2"
      description="Cadastro técnico de peças e componentes: SKU, especificações, imagens, documentos técnicos e tabela de preços por faixa de quantidade."
    />
  );
}
