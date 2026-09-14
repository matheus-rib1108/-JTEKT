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
                Transforme estoque parado em espaço, giro e receita — sem destruir a margem.
              </h1>
              <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-white/70">
                O StockFlow B2B combina controle de estoque, endereçamento de armazém, análise
                ABC/XYZ e um marketplace B2B privado para que fabricantes e distribuidores
                identifiquem excedentes, liberem posições físicas e vendam de forma inteligente
                para outras empresas.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/register">
                  <Button variant="secondary">Cadastrar minha empresa</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/5">
                    Já tenho acesso
                  </Button>
                </Link>
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Smart Stock Engine — exemplo ilustrativo
              </p>
              <div className="mt-3 space-y-2.5 font-tabular text-[13px] text-white/80">
                <Row label="Estoque disponível" value="420 un." />
                <Row label="Consumo médio" value="15 un./mês" />
                <Row label="Posições ocupadas" value="8" />
                <Row label="Classificação" value="CZ" />
                <Row label="Prioridade de redução" value="92 / 100" highlight />
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-white/50">
                Ilustração do cálculo do motor de estoque — os números reais aparecem apenas após
                o cadastro de produtos e movimentações (Fase 2 em diante).
              </p>
            </div>
          </div>
        </section>

        <section id="plataforma" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-brand-700">
            Uma plataforma, cinco motores
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Smart Stock Engine"
              description="Classificação ABC/XYZ e índice de prioridade de redução (0–100) calculados a partir de giro, cobertura, espaço ocupado e criticidade real."
            />
            <FeatureCard
              title="Motor de preços"
              description="Margem mínima, preço mínimo e descontos progressivos por quantidade — nunca aprova automaticamente uma venda abaixo do piso configurado."
            />
            <FeatureCard
              title="Ofertas de estoque"
              description="Transforma excedente identificado em condição comercial, com meta de redução e acompanhamento de resultado."
            />
            <FeatureCard
              title="Armazém e endereçamento"
              description="Galpão · Corredor · Rack · Nível · Posição — com indicador de posições fora do padrão e simulador de capacidade."
            />
            <FeatureCard
              title="Marketplace B2B privado"
              description="Catálogo técnico, cotação, carrinho com desconto por volume e acompanhamento de pedido até a expedição."
            />
            <FeatureCard
              title="Auditoria e RBAC"
              description="Permissões por função verificadas no servidor e trilha de auditoria para toda ação sensível — preço, estoque, aprovação, acesso."
            />
          </div>
        </section>

        <section id="seguranca" className="border-t border-border-subtle bg-surface-muted/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-brand-700">
              Construído como software de operação, não como vitrine
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] text-text-muted">
              Sessões protegidas, senhas com hash seguro, proteção contra força bruta, validação
              server-side e cadastro de empresas com fluxo de aprovação — cada módulo comercial
              nasce sobre essa base.
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

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5">
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}
