import Link from "next/link";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Prisma, QuoteStatus } from "@prisma/client";

export const metadata = { title: "Cotações — StockFlow B2B" };

const STATUS_LABEL: Record<QuoteStatus, string> = {
  REQUESTED: "Solicitada",
  PROPOSED: "Proposta enviada",
  ACCEPTED: "Aceita",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
};
const STATUS_TONE: Record<QuoteStatus, "neutral" | "success" | "warning" | "danger" | "brand"> = {
  REQUESTED: "warning",
  PROPOSED: "brand",
  ACCEPTED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function CotacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const auth = await requirePermission(PERMISSIONS.QUOTES_VIEW);
  if (!auth.user) return <Forbidden />;

  const params = await searchParams;
  const where: Prisma.QuoteWhereInput = { tenantId: auth.user.tenantId };
  if (params.status) where.status = params.status as QuoteStatus;

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customerCompany: { select: { legalName: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Cotações</h1>
        <p className="text-[13px] text-text-muted">
          Solicitações de preço especial dos clientes. Uma proposta nunca fica abaixo do preço
          mínimo configurado do produto.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["REQUESTED", "PROPOSED", "ACCEPTED", "REJECTED", "CANCELLED"] as const).map((status) => (
          <Link
            key={status}
            href={`/admin/cotacoes?status=${status}`}
            className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-[13px] ${
              params.status === status ? "border-brand-500 bg-brand-50 text-brand-800" : "border-border-strong text-text-muted hover:bg-surface-muted"
            }`}
          >
            {STATUS_LABEL[status]}
          </Link>
        ))}
        {params.status ? (
          <Link href="/admin/cotacoes" className="text-[13px] text-text-muted hover:underline">
            Limpar filtro
          </Link>
        ) : null}
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="Nenhuma cotação encontrada"
          description="Cotações aparecem aqui quando um cliente solicita um preço especial no portal."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium text-right">Quantidade</th>
                <th className="px-4 py-2.5 font-medium">Solicitada em</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {quotes.map((quote) => {
                const item = quote.items[0];
                return (
                  <tr key={quote.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-2.5 font-medium text-foreground">{quote.customerCompany.legalName}</td>
                    <td className="px-4 py-2.5 text-text-muted">{item ? `${item.product.sku} — ${item.product.name}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{item ? `${item.quantity} ${item.product.unit}` : "—"}</td>
                    <td className="px-4 py-2.5 text-text-muted">{quote.createdAt.toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[quote.status]}>{STATUS_LABEL[quote.status]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/cotacoes/${quote.id}`} className="text-brand-700 hover:underline">
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
