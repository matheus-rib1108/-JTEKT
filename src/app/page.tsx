import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        <section className="border-b border-border-subtle bg-brand-950">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <Badge tone="brand">Plataforma B2B para operações industriais</Badge>
              <h1 className="mt-4 text-[32px] font-semibold leading-tight text-white sm:text-[38px]">
                Estoque, armazém e vendas entre empresas em um sistema. Nenhuma venda sai abaixo
                da margem que você configurou.
              </h1>
              <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-white/70">
                O StockFlow B2B calcula qual peça é excedente, onde ela está fisicamente alocada
                e a que preço pode ser vendida a outra empresa. A classificação ABC/XYZ, o piso
                de preço e a reserva de estoque rodam no servidor: a interface mostra o número,
                não decide por trás dele.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/register">
                  <Button variant="secondary">Cadastrar minha empresa</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/5">
                    Já tenho acesso
                  </Button>
                </Link>
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Smart Stock Engine · exemplo ilustrativo
              </p>
              <div className="mt-3 space-y-2.5 font-tabular text-[13px] text-white/80">
                <Row label="Estoque disponível" value="420 un." />
                <Row label="Consumo médio" value="15 un./mês" />
                <Row label="Posições ocupadas" value="8" />
                <Row label="Classificação" value="CZ" />
                <Row label="Prioridade de redução" value="92 / 100" highlight />
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-white/50">
                Cálculo do motor de estoque com dados de exemplo. Os números reais só aparecem
                depois que produtos e movimentações são cadastrados.
              </p>
            </div>
          </div>
        </section>

        <section id="plataforma" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-brand-700">
            Dois motores decidem o preço e o giro. O resto do sistema executa em torno deles.
          </h2>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <CoreEngineCard
              title="Smart Stock Engine"
              stat="0–100"
              statLabel="índice de prioridade de redução"
              description="Cruza giro, cobertura de estoque, espaço ocupado no armazém e valor imobilizado para classificar cada produto em ABC (impacto financeiro) e XYZ (previsibilidade de demanda). Sem histórico suficiente, o campo fica em branco — o sistema não estima."
            />
            <CoreEngineCard
              title="Motor de preços"
              stat="R$ mín."
              statLabel="piso configurado por produto"
              description="Margem mínima, preço mínimo e desconto progressivo por faixa de quantidade. Uma proposta de cotação abaixo do piso é bloqueada antes de chegar ao cliente — inclusive para quem tem permissão de aprovar preço."
            />
          </div>

          <ul className="mt-8 grid gap-x-8 gap-y-3 border-t border-border-subtle pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <CapabilityItem
              title="Ofertas de excedente"
              description="Vincula o produto classificado como excedente a uma condição comercial e uma meta de redução."
            />
            <CapabilityItem
              title="Armazém e endereçamento"
              description="Galpão, corredor, rack, nível e posição. Posições fora do padrão ficam marcadas para correção."
            />
            <CapabilityItem
              title="Cotação e pedido"
              description="Do carrinho com desconto por volume até a separação, embalagem e expedição do pedido confirmado."
            />
            <CapabilityItem
              title="Permissões e auditoria"
              description="Cada ação sensível — preço, estoque, aprovação de acesso — é checada no servidor e fica registrada."
            />
          </ul>
        </section>

        <section id="seguranca" className="border-t border-border-subtle bg-surface-muted/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-brand-700">
              Autenticação e acesso
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] text-text-muted">
              Sessões com token opaco (não JWT), senha com hash e bloqueio por tentativas, e
              cadastro de empresa cliente com fluxo de aprovação: um administrador revisa, um
              segundo, diferente do primeiro, aprova. Autenticação em duas etapas por app
              autenticador (TOTP) está disponível para qualquer conta interna.
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0 last:pb-0">
      <span className="text-white/50">{label}</span>
      <span className={highlight ? "font-semibold text-accent-500" : "text-white"}>{value}</span>
    </div>
  );
}

function CoreEngineCard({
  title,
  stat,
  statLabel,
  description,
}: {
  title: string;
  stat: string;
  statLabel: string;
  description: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-surface p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        <span className="font-tabular text-[13px] text-accent-600">{stat}</span>
      </div>
      <p className="text-[11px] uppercase tracking-wide text-text-faint">{statLabel}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}

function CapabilityItem({ title, description }: { title: string; description: string }) {
  return (
    <li>
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{description}</p>
    </li>
  );
}
