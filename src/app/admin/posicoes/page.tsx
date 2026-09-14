import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BaselineForm } from "./baseline-form";
import { MarkCorrectedButton } from "./mark-corrected-button";
import { NON_STANDARD_BASELINE_KEY } from "@/lib/warehouse-constants";

export const metadata = { title: "Posições fora do padrão — StockFlow B2B" };

function readBaselineCount(value: unknown): number | null {
  if (typeof value === "object" && value !== null && "count" in value) {
    const count = (value as { count: unknown }).count;
    return typeof count === "number" ? count : null;
  }
  return null;
}

export default async function PosicoesPage() {
  const auth = await requirePermission(PERMISSIONS.WAREHOUSE_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.WAREHOUSE_MANAGE);

  const [currentCount, totalPositions, baselineSetting, nonStandardLocations, recentHistory] = await Promise.all([
    prisma.storageLocation.count({ where: { tenantId: auth.user.tenantId, isNonStandard: true } }),
    prisma.storageLocation.count({ where: { tenantId: auth.user.tenantId } }),
    prisma.systemSetting.findUnique({
      where: { tenantId_key: { tenantId: auth.user.tenantId, key: NON_STANDARD_BASELINE_KEY } },
    }),
    prisma.storageLocation.findMany({
      where: { tenantId: auth.user.tenantId, isNonStandard: true },
      include: { warehouse: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId: auth.user.tenantId,
        action: { in: ["storage_location.mark_corrected", "storage_location.mark_non_standard"] },
      },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const baseline = readBaselineCount(baselineSetting?.value);
  const progressPct = baseline && baseline > 0 ? Math.max(0, Math.min(100, Math.round(((baseline - currentCount) / baseline) * 100))) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Posições fora do padrão</h1>
        <p className="text-[13px] text-text-muted">
          Endereços que não seguem o esquema formal de endereçamento (§17) — independente de estarem
          ocupados ou não. Meta: chegar a zero.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total de posições" value={totalPositions} />
        <Kpi label="Fora do padrão (atual)" value={currentCount} highlight={currentCount > 0} />
        <Kpi label="Meta" value={0} />
        <Kpi label="Progresso" value={progressPct !== null ? `${progressPct}%` : "—"} isText />
      </div>

      {baseline === null ? (
        canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Definir meta inicial</CardTitle>
              <CardDescription>
                Informe quantas posições fora do padrão existiam quando este acompanhamento começou.
                O progresso é calculado a partir desse número — sem meta definida, não há progresso a
                mostrar (§19: nunca apresentar um resultado como fato sem dado suficiente).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BaselineForm currentCount={currentCount} />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="Meta ainda não definida"
            description="Um administrador precisa registrar o total inicial de posições fora do padrão para este indicador mostrar progresso."
          />
        )
      ) : null}

      {nonStandardLocations.length === 0 ? (
        <EmptyState
          title="Nenhuma posição fora do padrão"
          description="Todas as posições cadastradas seguem o esquema formal de endereçamento."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Código</th>
                <th className="px-4 py-2.5 font-medium">Galpão</th>
                <th className="px-4 py-2.5 font-medium">Observação</th>
                {canManage ? <th className="px-4 py-2.5 font-medium text-right">Ações</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {nonStandardLocations.map((loc) => (
                <tr key={loc.id}>
                  <td className="px-4 py-2.5 font-tabular font-medium text-foreground">{loc.code}</td>
                  <td className="px-4 py-2.5 text-text-muted">{loc.warehouse.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{loc.nonStandardNote ?? "—"}</td>
                  {canManage ? (
                    <td className="px-4 py-2.5">
                      <MarkCorrectedButton storageLocationId={loc.id} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de correções</CardTitle>
          <CardDescription>Trilha de quando cada posição foi marcada e corrigida — comprova a evolução (§17).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentHistory.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-text-muted">Nenhum evento registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {recentHistory.map((entry) => {
                const code = typeof entry.afterData === "object" && entry.afterData && "code" in entry.afterData
                  ? String((entry.afterData as { code: unknown }).code)
                  : "—";
                const corrected = entry.action === "storage_location.mark_corrected";
                return (
                  <li key={entry.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <div className="flex items-center gap-2">
                      <Badge tone={corrected ? "success" : "warning"}>
                        {corrected ? "Corrigida" : "Marcada"}
                      </Badge>
                      <span className="font-tabular font-medium text-foreground">{code}</span>
                    </div>
                    <span className="text-text-muted">
                      {entry.actor?.name ?? "—"} · {entry.createdAt.toLocaleString("pt-BR")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, highlight, isText }: { label: string; value: number | string; highlight?: boolean; isText?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[12px] text-text-muted">{label}</p>
        <p
          className={`mt-1.5 font-tabular text-2xl font-semibold ${highlight ? "text-warning-700" : "text-foreground"} ${isText ? "font-sans" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
