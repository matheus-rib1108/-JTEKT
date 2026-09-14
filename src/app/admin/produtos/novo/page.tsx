import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { createProduct } from "../actions";

export const metadata = { title: "Novo produto — StockFlow B2B" };

export default async function NovoProdutoPage() {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return <Forbidden />;

  const categories = await prisma.category.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Novo produto</h1>
      <Card>
        <CardHeader>
          <CardTitle>Dados do produto</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            action={createProduct}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            submitLabel="Cadastrar produto"
          />
        </CardContent>
      </Card>
    </div>
  );
}
