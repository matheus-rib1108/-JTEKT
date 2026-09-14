import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { PERMISSIONS } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { acceptProductQuote, rejectProductQuote, cancelProductQuote } from "./actions";
import { QuoteActions } from "./quote-actions";
import type { QuoteStatus } from "@prisma/client";

export const metadata = { title: "Cotações — StockFlow B2B" };

const STATUS_LABEL: Record<QuoteStatus, string> = {
  REQUESTED: "Aguardando resposta",
  PROPOSED: "Proposta recebida",
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

export default async function PortalCotacoesPage() {
  const user = await getCurrentUser();
  if (!user || !user.customerCompanyId) return null;

  const canManage = user.permissions.has(PERMISSIONS.CLIENT_QUOTES_MANAGE);

  const quotes = await prisma.quote.findMany({
    where: { tenantId: user.tenantId, customerCompanyId: user.customerCompanyId },
    include: { items: { include: { product: { select: { name: true, sku: true, unit: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Cotações</h1>
        <p className="text-[13px] text-text-muted">
          Solicite um preço especial a partir da página de um produto. Acompanhe aqui a resposta
          da nossa equipe comercial.
        </p>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="Nenhuma cotação solicitada ainda"
          description='Use "Solicitar cotação" na página de um produto para pedir um preço especial.'
        />
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const item = quote.items[0];
            return (
              <Card key={quote.id}>
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{item ? item.product.name : "—"}</p>
                      <p className="font-tabular text-[12px] text-text-muted">
                        {item ? `${item.quantity} ${item.product.unit}` : ""} · solicitada em{" "}
                        {quote.createdAt.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[quote.status]}>{STATUS_LABEL[quote.status]}</Badge>
                  </div>

                  {quote.message ? (
                    <p className="mt-2 text-[13px] text-text-muted">Sua mensagem: “{quote.message}”</p>
                  ) : null}

                  {quote.status === "PROPOSED" && item?.proposedUnitPrice != null ? (
                    <div className="mt-3 border-t border-border-subtle pt-3">
                      <p className="text-[13px] text-text-muted">
                        Preço proposto:{" "}
                        <span className="font-tabular text-lg font-semibold text-foreground">
                          {formatCurrency(Number(item.proposedUnitPrice))}
                        </span>{" "}
                        /{item.product.unit}
                      </p>
                      {quote.responseMessage ? (
                        <p className="mt-1 text-[13px] text-text-muted">{quote.responseMessage}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {canManage && (quote.status === "PROPOSED" || quote.status === "REQUESTED") ? (
                    <div className="mt-3 flex justify-end border-t border-border-subtle pt-3">
                      <QuoteActions
                        quoteId={quote.id}
                        status={quote.status}
                        acceptAction={acceptProductQuote}
                        rejectAction={rejectProductQuote}
                        cancelAction={cancelProductQuote}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
