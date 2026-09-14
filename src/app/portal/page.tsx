import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";

export const metadata = { title: "Início — StockFlow B2B" };

export default async function PortalHomePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const company = user.customerCompanyId
    ? await prisma.customerCompany.findUnique({ where: { id: user.customerCompanyId } })
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Olá, {user.name.split(" ")[0]}</h1>
        <p className="text-[13px] text-text-muted">{company?.legalName}</p>
      </div>

      {company?.status === "PENDING_VALIDATION" ? (
        <Alert tone="warning">
          Seu cadastro está em análise pela nossa equipe comercial. Você poderá navegar pelo
          catálogo e solicitar cotações assim que a validação for concluída.
        </Alert>
      ) : null}
      {company?.status === "BLOCKED" ? (
        <Alert tone="danger">
          Sua empresa está temporariamente bloqueada. Entre em contato com o suporte para mais
          informações.
        </Alert>
      ) : null}
      {company?.status === "ACTIVE" ? (
        <Alert tone="success">Cadastro aprovado. Sua empresa já pode navegar pelo catálogo.</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard href="/portal/produtos" title="Produtos" description="Catálogo técnico de peças e componentes." />
        <NavCard href="/portal/ofertas" title="Ofertas" description="Condições especiais para estoque excedente." />
        <NavCard href="/portal/cotacoes" title="Cotações" description="Solicite preços e prazos sob condições específicas." />
        <NavCard href="/portal/pedidos" title="Meus pedidos" description="Acompanhe pedidos em andamento e histórico." />
        <NavCard href="/portal/conta" title="Minha empresa" description="Dados cadastrais e usuários da sua empresa." />
        <NavCard href="/portal/suporte" title="Suporte" description="Fale com nossa equipe comercial." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo ainda não disponível</CardTitle>
          <CardDescription>
            Produtos, ofertas, cotações, carrinho e pedidos entram em operação a partir da Fase 5.
            Nenhuma informação de produto exibida aqui é real até essa fase.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}

function NavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="block rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 hover:border-brand-400">
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[12px] text-text-muted">{description}</p>
    </Link>
  );
}
