import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { renderReport, type ExportFormat } from "@/server/reports/export";
import { computeOrderTotals } from "@/lib/orders";

function parseFormat(value: string | null): ExportFormat | null {
  if (value === "csv" || value === "xlsx" || value === "pdf") return value;
  return null;
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Enviado",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  if (!auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });

  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  if (!format) return NextResponse.json({ error: "Formato inválido." }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: { tenantId: auth.user.tenantId, status: { not: "DRAFT" } },
    include: { customerCompany: { select: { legalName: true } }, items: true },
    orderBy: { submittedAt: "desc" },
  });

  const rows = orders.map((order) => {
    const totals = computeOrderTotals(
      order.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice), listPriceUnitPrice: Number(i.listPriceUnitPrice) })),
    );
    return [
      order.id,
      order.customerCompany.legalName,
      STATUS_LABEL[order.status] ?? order.status,
      order.submittedAt?.toLocaleString("pt-BR") ?? "",
      order.items.length,
      totals.subtotal.toFixed(2),
      totals.savings.toFixed(2),
    ];
  });

  const { body, contentType, extension } = await renderReport(
    {
      title: "Relatório de pedidos",
      headers: ["Pedido", "Empresa", "Status", "Enviado em", "Itens", "Total", "Economia"],
      rows,
    },
    format,
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="pedidos.${extension}"`,
    },
  });
}
