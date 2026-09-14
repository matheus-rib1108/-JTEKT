import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductForm } from "../product-form";
import { updateProduct } from "../actions";
import { MovementForm } from "./movement-form";
import { AvailabilityForm } from "./availability-form";
import { AllocationForm } from "./allocation-form";

const STATUS_LABEL = { DRAFT: "Rascunho", ACTIVE: "Ativo", DISCONTINUED: "Descontinuado" } as const;
const MOVEMENT_LABEL: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
  RESERVA: "Reserva",
  LIBERACAO_RESERVA: "Liberação de reserva",
  BLOQUEIO: "Bloqueio",
  DESBLOQUEIO: "Desbloqueio",
};

export default async function ProdutoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_VIEW);
  if (!auth.user) return <Forbidden />;

  const { id } = await params;
  const canManageProduct = auth.user.permissions.has(PERMISSIONS.PRODUCTS_MANAGE);
  const canManageInventory = auth.user.permissions.has(PERMISSIONS.INVENTORY_MANAGE);
  const canManageWarehouse = auth.user.permissions.has(PERMISSIONS.WAREHOUSE_MANAGE);

  const [product, categories, availableLocations] = await Promise.all([
    prisma.product.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      include: {
        category: true,
        inventory: true,
        movements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { performedBy: { select: { name: true } } },
        },
        storageAllocations: {
          include: { storageLocation: { include: { warehouse: true } } },
          orderBy: { createdAt: "asc" },
        },
        classification: true,
      },
    }),
    prisma.category.findMany({ where: { tenantId: auth.user.tenantId }, orderBy: { name: "asc" } }),
    prisma.storageLocation.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: [{ corridor: "asc" }, { rack: "asc" }, { level: "asc" }, { position: "asc" }],
      select: { id: true, code: true },
    }),
  ]);

  if (!product) notFound();

  const inventory = product.inventory ?? {
    quantityOnHand: 0,
    quantityReserved: 0,
    quantityBlocked: 0,
    quantityAvailableToSell: 0,
    reorderPoint: null,
    maxStock: null,
    safetyStock: null,
  };
  const freeStock = inventory.quantityOnHand - inventory.quantityReserved - inventory.quantityBlocked;
  const belowReorderPoint = inventory.reorderPoint !== null && inventory.quantityOnHand < inventory.reorderPoint;

  const specifications = Array.isArray(product.specifications)
    ? (product.specifications as { key: string; value: string }[])
    : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/produtos" className="text-[13px] text-brand-700 hover:underline">
          ← Produtos
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">{product.name}</h1>
          <Badge tone={product.status === "ACTIVE" ? "success" : "neutral"}>
            {STATUS_LABEL[product.status]}
          </Badge>
          {belowReorderPoint ? <Badge tone="warning">Abaixo do estoque mínimo</Badge> : null}
        </div>
        <p className="font-tabular text-[13px] text-text-muted">{product.sku}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dados do produto</CardTitle>
          </CardHeader>
          <CardContent>
            {canManageProduct ? (
              <ProductForm
                action={updateProduct.bind(null, product.id)}
                categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                initialValues={{
                  sku: product.sku,
                  name: product.name,
                  description: product.description ?? "",
                  categoryId: product.categoryId ?? "",
                  manufacturer: product.manufacturer ?? "",
                  model: product.model ?? "",
                  unit: product.unit,
                  minCommercialQuantity: product.minCommercialQuantity,
                  status: product.status,
                  unitCost: product.unitCost?.toString() ?? "",
                  specifications,
                }}
              />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <DetailRow label="Categoria" value={product.category?.name ?? "—"} />
                <DetailRow label="Fabricante" value={product.manufacturer ?? "—"} />
                <DetailRow label="Modelo" value={product.model ?? "—"} />
                <DetailRow label="Unidade" value={product.unit} />
                {specifications.map((spec) => (
                  <DetailRow key={spec.key} label={spec.key} value={spec.value} />
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estoque interno</CardTitle>
              <CardDescription>Visível apenas para a equipe (§9).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 font-tabular text-[13px]">
              <DetailRow label="Em mãos" value={String(inventory.quantityOnHand)} />
              <DetailRow label="Reservado" value={String(inventory.quantityReserved)} />
              <DetailRow label="Bloqueado" value={String(inventory.quantityBlocked)} />
              <DetailRow label="Livre" value={String(freeStock)} />
              <DetailRow label="Disponível p/ venda" value={String(inventory.quantityAvailableToSell)} />
              <DetailRow label="Estoque mínimo" value={inventory.reorderPoint?.toString() ?? "—"} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ClassificationCard classification={product.classification} unitCost={product.unitCost} />

      {canManageInventory ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Registrar movimento de estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <MovementForm productId={product.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Disponibilidade comercial</CardTitle>
              <CardDescription>Quanto do estoque livre fica exposto para venda (§9).</CardDescription>
            </CardHeader>
            <CardContent>
              <AvailabilityForm
                productId={product.id}
                freeStock={freeStock}
                initial={{
                  quantityAvailableToSell: inventory.quantityAvailableToSell,
                  reorderPoint: inventory.reorderPoint,
                  maxStock: inventory.maxStock,
                  safetyStock: inventory.safetyStock,
                }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de movimentações</CardTitle>
          <CardDescription>Últimos 20 eventos — trilha completa em Auditoria.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {product.movements.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-text-muted">Nenhuma movimentação registrada ainda.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">Data</th>
                  <th className="px-5 py-2 font-medium">Tipo</th>
                  <th className="px-5 py-2 font-medium text-right">Quantidade</th>
                  <th className="px-5 py-2 font-medium text-right">Saldo resultante</th>
                  <th className="px-5 py-2 font-medium">Motivo</th>
                  <th className="px-5 py-2 font-medium">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {product.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="px-5 py-2 font-tabular text-text-muted">
                      {movement.createdAt.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-2">{MOVEMENT_LABEL[movement.type]}</td>
                    <td className="px-5 py-2 text-right font-tabular">{movement.quantity}</td>
                    <td className="px-5 py-2 text-right font-tabular">{movement.resultingQuantityOnHand}</td>
                    <td className="px-5 py-2 text-text-muted">{movement.reason ?? "—"}</td>
                    <td className="px-5 py-2 text-text-muted">{movement.performedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posições no armazém</CardTitle>
          <CardDescription>Onde este produto está fisicamente alocado (§15).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {product.storageAllocations.length === 0 ? (
            <p className="text-[13px] text-text-muted">Nenhuma posição alocada para este produto ainda.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {product.storageAllocations.map((allocation) => (
                <li key={allocation.id} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="font-tabular font-medium text-foreground">
                    {allocation.storageLocation.code}
                  </span>
                  <span className="text-text-muted">{allocation.storageLocation.warehouse.name}</span>
                  <span className="font-tabular font-medium text-foreground">{allocation.quantity} un.</span>
                </li>
              ))}
            </ul>
          )}

          {canManageWarehouse ? (
            <div className="border-t border-border-subtle pt-4">
              <AllocationForm productId={product.id} locations={availableLocations} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-text-faint">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

const ABC_EXPLANATION = {
  A: "Alto impacto financeiro — evitar reduções agressivas.",
  B: "Impacto intermediário.",
  C: "Baixo impacto — candidato a otimização de espaço/estoque.",
} as const;

const XYZ_EXPLANATION = {
  X: "Demanda previsível.",
  Y: "Demanda variável.",
  Z: "Demanda irregular.",
} as const;

interface ClassificationFactors {
  coverageDays: number | null;
  daysSinceLastMovement: number | null;
  occupiedPositions: number;
  valueTied: number | null;
  scoreBeforeDampening: number;
  abcDampeningApplied: boolean;
}

function ClassificationCard({
  classification,
  unitCost,
}: {
  classification: {
    abcClass: string | null;
    xyzClass: string | null;
    priorityScore: number | null;
    factors: unknown;
    computedAt: Date;
  } | null;
  unitCost: unknown;
}) {
  if (!classification) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Classificação Smart Stock Engine</CardTitle>
          <CardDescription>Ainda não calculada. Use &quot;Recalcular&quot; em Estoque.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const factors = classification.factors as Partial<ClassificationFactors> | null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classificação Smart Stock Engine</CardTitle>
        <CardDescription>
          Calculada em {classification.computedAt.toLocaleString("pt-BR")} — transparente, a partir
          dos números reais abaixo (§3/§4).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-faint">ABC</p>
            {classification.abcClass ? (
              <>
                <p className="text-[15px] font-semibold text-foreground">{classification.abcClass}</p>
                <p className="text-[12px] text-text-muted">
                  {ABC_EXPLANATION[classification.abcClass as "A" | "B" | "C"]}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-text-faint">
                N/D {unitCost === null ? "— cadastre o custo unitário" : ""}
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-faint">XYZ</p>
            {classification.xyzClass ? (
              <>
                <p className="text-[15px] font-semibold text-foreground">{classification.xyzClass}</p>
                <p className="text-[12px] text-text-muted">
                  {XYZ_EXPLANATION[classification.xyzClass as "X" | "Y" | "Z"]}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-text-faint">N/D — sem histórico de saídas suficiente</p>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-faint">Prioridade de redução</p>
            <p className="text-[15px] font-semibold text-foreground">
              {classification.priorityScore ?? "—"}/100
            </p>
            {factors?.abcDampeningApplied ? (
              <p className="text-[12px] text-text-muted">
                Reduzido de {factors.scoreBeforeDampening} por ser classe A.
              </p>
            ) : null}
          </div>
        </div>

        {factors ? (
          <dl className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3 text-[13px] sm:grid-cols-3">
            <DetailRow
              label="Cobertura estimada"
              value={factors.coverageDays != null ? `${Math.round(factors.coverageDays)} dias` : "Sem consumo registrado"}
            />
            <DetailRow
              label="Dias sem movimentação"
              value={factors.daysSinceLastMovement != null ? String(factors.daysSinceLastMovement) : "—"}
            />
            <DetailRow label="Posições ocupadas" value={String(factors.occupiedPositions ?? 0)} />
            <DetailRow
              label="Valor parado"
              value={
                factors.valueTied != null
                  ? factors.valueTied.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "Sem custo cadastrado"
              }
            />
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
