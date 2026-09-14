import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { renderReport, type ExportFormat } from "@/server/reports/export";

function parseFormat(value: string | null): ExportFormat | null {
  if (value === "csv" || value === "xlsx" || value === "pdf") return value;
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  if (!auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });

  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  if (!format) return NextResponse.json({ error: "Formato inválido." }, { status: 400 });

  const products = await prisma.product.findMany({
    where: { tenantId: auth.user.tenantId, status: { not: "DISCONTINUED" } },
    include: { category: true, inventory: true },
    orderBy: { sku: "asc" },
  });

  const rows = products.map((p) => {
    const inv = p.inventory;
    const unitCost = p.unitCost != null ? Number(p.unitCost) : null;
    const valueTied = unitCost != null ? unitCost * (inv?.quantityOnHand ?? 0) : null;
    return [
      p.sku,
      p.name,
      p.category?.name ?? "",
      inv?.quantityOnHand ?? 0,
      inv?.quantityReserved ?? 0,
      inv?.quantityBlocked ?? 0,
      inv?.quantityAvailableToSell ?? 0,
      unitCost != null ? unitCost.toFixed(2) : "",
      valueTied != null ? valueTied.toFixed(2) : "",
    ];
  });

  const { body, contentType, extension } = await renderReport(
    {
      title: "Relatório de estoque",
      headers: ["SKU", "Produto", "Categoria", "Em mãos", "Reservado", "Bloqueado", "Disponível p/ venda", "Custo unitário", "Valor parado"],
      rows,
    },
    format,
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="estoque.${extension}"`,
    },
  });
}
