import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Categorias — StockFlow B2B" };

export default async function Page() {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_VIEW);
  if (!auth.user) return <Forbidden />;

  return (
    <PlaceholderPage
      title="Categorias"
      phaseLabel="Fase 2"
      description="Árvore de categorias e aplicações usada para navegação do catálogo B2B e para os filtros do painel de estoque."
    />
  );
}
