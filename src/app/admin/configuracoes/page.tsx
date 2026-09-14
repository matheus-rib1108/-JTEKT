import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SESSION_TTL_MS } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { DEFAULT_PRIORITY_WEIGHTS, type PriorityWeights } from "@/lib/stockClassification";
import { PRIORITY_WEIGHTS_SETTING_KEY } from "@/lib/analytics-constants";
import { WeightsForm } from "./weights-form";

export const metadata = { title: "Configurações — StockFlow B2B" };

export default async function ConfiguracoesPage() {
  const auth = await requirePermission(PERMISSIONS.SETTINGS_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManageWeights = auth.user.permissions.has(PERMISSIONS.SETTINGS_MANAGE);
  const weightsSetting = await prisma.systemSetting.findUnique({
    where: { tenantId_key: { tenantId: auth.user.tenantId, key: PRIORITY_WEIGHTS_SETTING_KEY } },
  });
  const currentWeights: PriorityWeights = {
    ...DEFAULT_PRIORITY_WEIGHTS,
    ...(weightsSetting?.value as Partial<PriorityWeights> | undefined),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Configurações</h1>
        <p className="text-[13px] text-text-muted">
          Parâmetros de segurança e do Smart Stock Engine. Regras de precificação e margens
          mínimas serão configuráveis aqui a partir da Fase 6.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pesos do índice de prioridade de redução</CardTitle>
          <CardDescription>
            Quanto cada fator pesa no score 0-100 de cada produto (§4). Alterar aqui só muda os
            próximos recálculos — use &quot;Recalcular&quot; em Estoque para aplicar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManageWeights ? (
            <WeightsForm current={currentWeights} />
          ) : (
            <p className="text-[13px] text-text-muted">
              Cobertura {currentWeights.coverage} · Idle {currentWeights.idle} · Espaço{" "}
              {currentWeights.space} · Valor {currentWeights.value}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessão e senha</CardTitle>
          <CardDescription>Aplicados no servidor a cada requisição — não são apenas preferências de tela.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <ConfigRow label="Duração da sessão" value={`${SESSION_TTL_MS / 1000 / 60 / 60}h`} />
          <ConfigRow label="Requisitos de senha" value="Mínimo 10 caracteres, letras e números" />
          <ConfigRow label="Bloqueio de conta" value="5 tentativas incorretas → 15 min de bloqueio" />
          <ConfigRow label="Cookies de sessão" value="HttpOnly, SameSite=Lax, Secure em produção" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <CardDescription>Nenhum provedor externo está conectado nesta instalação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <IntegrationRow name="E-mail transacional (SMTP/SES/SendGrid)" />
          <IntegrationRow name="Gateway de pagamento (PIX/cartão/boleto)" />
          <IntegrationRow name="ERP / WMS" />
          <IntegrationRow name="Transportadoras" />
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border-subtle px-3.5 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-text-faint">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function IntegrationRow({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border-subtle px-3.5 py-2.5">
      <span className="text-[13px] text-foreground">{name}</span>
      <Badge tone="neutral">Pendente de configuração</Badge>
    </div>
  );
}
