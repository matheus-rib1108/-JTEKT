import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/forbidden";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InviteEmployeeForm } from "./invite-employee-form";

export const metadata = { title: "Usuários — StockFlow B2B" };

const STATUS_TONE = {
  ACTIVE: "success",
  INVITED: "warning",
  SUSPENDED: "danger",
  DISABLED: "danger",
} as const;

export default async function UsuariosPage() {
  const auth = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW);
  if (!auth.user) return <Forbidden />;

  const canManage = auth.user.permissions.has(PERMISSIONS.EMPLOYEES_MANAGE);

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: auth.user.tenantId, userType: "INTERNAL" },
      include: { role: true },
      orderBy: { createdAt: "asc" },
    }),
    canManage
      ? prisma.role.findMany({ where: { isClientRole: false }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Usuários internos</h1>
        <p className="text-[13px] text-text-muted">
          Contas de acesso da equipe (§26/§27). Permissões são aplicadas por função e verificadas
          no servidor a cada requisição.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Convidar novo usuário</CardTitle>
            <CardDescription>
              O convidado recebe um link para definir a própria senha (e-mail ainda não integrado a
              um provedor real — ver Configurações).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteEmployeeForm roles={roles} />
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium">E-mail</th>
              <th className="px-4 py-2.5 font-medium">Função</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Último login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5 font-medium text-foreground">{u.name}</td>
                <td className="px-4 py-2.5 text-text-muted">{u.email}</td>
                <td className="px-4 py-2.5">{u.role.name}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-text-muted">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
