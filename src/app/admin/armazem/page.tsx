import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { WarehouseForm } from "./warehouse-form";
import { GeneratePositionsForm } from "./generate-positions-form";
import { WarehouseMap, type MapLocation } from "./warehouse-map";

export const metadata = { title: "Armazém — StockFlow B2B" };

export default async function ArmazemPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string }>;
}) {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.WAREHOUSE_MANAGE);
  const params = await searchParams;

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { code: "asc" },
    include: { _count: { select: { storageLocations: true } } },
  });

  const activeWarehouse = params.warehouseId
    ? warehouses.find((w) => w.id === params.warehouseId) ?? warehouses[0]
    : warehouses[0];

  const locations = activeWarehouse
    ? await prisma.storageLocation.findMany({
        where: { tenantId: auth.user.tenantId, warehouseId: activeWarehouse.id },
        include: { allocations: { include: { product: { select: { sku: true, name: true } } } } },
        orderBy: [{ corridor: "asc" }, { rack: "asc" }, { level: "asc" }, { position: "asc" }],
      })
    : [];

  const mapLocations: MapLocation[] = locations.map((loc) => ({
    id: loc.id,
    code: loc.code,
    area: loc.area,
    corridor: loc.corridor,
    rack: loc.rack,
    level: loc.level,
    position: loc.position,
    status: loc.status,
    isNonStandard: loc.isNonStandard,
    allocations: loc.allocations.map((a) => ({
      productName: a.product.name,
      productSku: a.product.sku,
      quantity: a.quantity,
    })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Armazém</h1>
        <p className="text-[13px] text-text-muted">
          Endereçamento físico (§15) e mapa visual de ocupação (§16). Posições fora do padrão são
          acompanhadas em detalhe na página Posições.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Galpões</CardTitle>
          </CardHeader>
          <CardContent>
            <WarehouseForm />
          </CardContent>
        </Card>
      ) : null}

      {warehouses.length === 0 ? (
        <EmptyState
          title="Nenhum galpão cadastrado"
          description={canManage ? "Crie o primeiro galpão para começar a endereçar o estoque." : "Ainda não há galpões cadastrados."}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {warehouses.map((warehouse) => (
              <Link
                key={warehouse.id}
                href={`/admin/armazem?warehouseId=${warehouse.id}`}
                className={cn(
                  "rounded-[var(--radius-sm)] border px-3 py-1.5 text-[13px]",
                  activeWarehouse?.id === warehouse.id
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-border-strong text-text-muted hover:bg-surface-muted",
                )}
              >
                {warehouse.name} ({warehouse._count.storageLocations} posições)
              </Link>
            ))}
          </div>

          {activeWarehouse ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Mapa de posições — {activeWarehouse.name}</CardTitle>
                  <CardDescription>Clique em uma posição para ver detalhes e ações.</CardDescription>
                </CardHeader>
                <CardContent>
                  <WarehouseMap locations={mapLocations} canManage={canManage} />
                </CardContent>
              </Card>

              {canManage ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Gerar posições em lote</CardTitle>
                    <CardDescription>
                      Cria todas as combinações de nível × posição para um corredor/rack de uma vez.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GeneratePositionsForm warehouseId={activeWarehouse.id} />
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
