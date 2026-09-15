import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { startMfaEnrollment, confirmMfaEnrollment, disableMfa } from "./actions";
import { MfaPanel } from "./mfa-panel";

export const metadata = { title: "Minha conta — StockFlow B2B" };

export default async function MinhaContaPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { mfaEnabled: true, role: { select: { name: true } } } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Minha conta</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da conta</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-faint">Nome</dt>
              <dd className="font-medium text-foreground">{user.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-faint">E-mail</dt>
              <dd className="font-medium text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-faint">Função</dt>
              <dd className="font-medium text-foreground">{current?.role.name}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autenticação em duas etapas</CardTitle>
          <CardDescription>Segurança da conta (§27) — segredo criptografado em repouso, nunca em texto puro.</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaPanel
            mfaEnabled={current?.mfaEnabled ?? false}
            startAction={startMfaEnrollment}
            confirmAction={confirmMfaEnrollment}
            disableAction={disableMfa}
          />
        </CardContent>
      </Card>
    </div>
  );
}
