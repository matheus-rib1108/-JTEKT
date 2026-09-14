import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { renderReport, type ExportFormat } from "@/server/reports/export";

function parseFormat(value: string | null): ExportFormat | null {
  if (value === "csv" || value === "xlsx" || value === "pdf") return value;
  return null;
}

/** Gated by AUDIT_VIEW (not REPORTS_VIEW) — same permission the on-screen
 * Auditoria page itself checks, so exporting the log never opens a wider
 * door than viewing it does. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  if (!auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });

  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  if (!format) return NextResponse.json({ error: "Formato inválido." }, { status: 400 });

  const logs = await prisma.auditLog.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { actor: { select: { email: true } } },
  });

  const rows = logs.map((log) => [
    log.createdAt.toLocaleString("pt-BR"),
    log.action,
    log.entityType,
    log.entityId ?? "",
    log.actor?.email ?? "",
    log.ipAddress ?? "",
  ]);

  const { body, contentType, extension } = await renderReport(
    {
      title: "Log de auditoria",
      headers: ["Data/hora", "Ação", "Entidade", "ID da entidade", "Autor", "IP"],
      rows,
    },
    format,
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="auditoria.${extension}"`,
    },
  });
}
