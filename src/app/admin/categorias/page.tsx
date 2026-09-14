import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CategoryForm } from "./category-form";
import { DeleteCategoryButton } from "./delete-category-button";

export const metadata = { title: "Categorias — StockFlow B2B" };

export default async function CategoriasPage() {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.PRODUCTS_MANAGE);

  const categories = await prisma.category.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { parent: true, _count: { select: { products: true, children: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Categorias</h1>
        <p className="text-[13px] text-text-muted">
          Árvore de categorias usada no catálogo B2B e nos filtros de estoque (§16).
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Nova categoria</CardTitle>
            <CardDescription>Categorias sem produtos ou subcategorias podem ser removidas.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
          </CardContent>
        </Card>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria cadastrada" description="Crie a primeira categoria para começar a organizar o catálogo." />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Categoria pai</th>
                <th className="px-4 py-2.5 font-medium">Produtos</th>
                {canManage ? <th className="px-4 py-2.5 font-medium text-right">Ações</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{category.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{category.parent?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 font-tabular">{category._count.products}</td>
                  {canManage ? (
                    <td className="px-4 py-2.5">
                      <DeleteCategoryButton categoryId={category.id} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
