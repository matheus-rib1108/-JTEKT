import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { respondToQuote } from "../actions";
import { RespondForm } from "./respond-form";
import type { QuoteStatus } from "@prisma/client";

export const metadata = { title: "Cotação — StockFlow B2B" };

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

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.QUOTES_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.QUOTES_MANAGE);
  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    include: {
      customerCompany: { select: { legalName: true } },
      items: { include: { product: { include: { pricing: true } } } },
      createdBy: { select: { name: true, email: true } },
      respondedBy: { select: { name: true } },
    },
  });
  if (!quote) notFound();

  const item = quote.items[0];
  const minPrice = item?.product.pricing?.minPrice != null ? Number(item.product.pricing.minPrice) : null;
  const listPrice = item?.product.pricing?.listPrice != null ? Number(item.product.pricing.listPrice) : null;

  return (
    <div className="space-y-5">
      <Link href="/admin/cotacoes" className="text-[13px] text-brand-700 hover:underline">
        ← Cotações
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Cotação</h1>
          <p className="text-[13px] text-text-muted">{quote.customerCompany.legalName}</p>
        </div>
        <Badge tone={STATUS_TONE[quote.status]}>{STATUS_LABEL[quote.status]}</Badge>
      </div>

      {item ? (
        <Card>
          <CardHeader>
            <CardTitle>{item.product.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-faint">Quantidade</dt>
                <dd className="font-medium text-foreground">{item.quantity} {item.product.unit}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-faint">Preço de lista</dt>
                <dd className="font-medium text-foreground">{listPrice != null ? formatCurrency(listPrice) : "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-faint">Preço pedido pelo cliente</dt>
                <dd className="font-medium text-foreground">
                  {item.requestedPrice != null ? formatCurrency(Number(item.requestedPrice)) : "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-faint">Proposta enviada</dt>
                <dd className="font-medium text-foreground">
                  {item.proposedUnitPrice != null ? formatCurrency(Number(item.proposedUnitPrice)) : "—"}
                </dd>
              </div>
            </dl>
            {quote.message ? (
              <p className="mt-3 border-t border-border-subtle pt-3 text-[13px] text-text-muted">
                Mensagem do cliente: “{quote.message}”
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {quote.status === "REQUESTED" && canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Responder com proposta</CardTitle>
          </CardHeader>
          <CardContent>
            <RespondForm quoteId={quote.id} minPrice={minPrice} action={respondToQuote} />
          </CardContent>
        </Card>
      ) : null}

      {quote.status !== "REQUESTED" && quote.responseMessage ? (
        <Card>
          <CardHeader>
            <CardTitle>Resposta enviada{quote.respondedBy ? ` por ${quote.respondedBy.name}` : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] text-text-muted">{quote.responseMessage}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
