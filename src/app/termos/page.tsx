import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = { title: "Termos de Uso — StockFlow B2B" };

export default function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 text-[14px] leading-relaxed text-foreground">
          <h1 className="text-[24px] font-semibold">Termos de Uso</h1>
          <p className="mt-2 text-[13px] text-text-muted">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}.
          </p>

          <div className="mt-6 rounded-[var(--radius-md)] border border-warning-600/40 bg-warning-100 p-4 text-[13px] text-warning-700">
            Este texto descreve, de forma factual, o funcionamento e as regras operacionais do
            sistema. Ele não substitui uma revisão jurídica formal — antes de operar com clientes
            reais, recomenda-se que um advogado revise e adapte cláusulas de responsabilidade,
            foro e legislação aplicável à operação real da empresa.
          </div>

          <Section title="1. O que é a plataforma">
            <p>
              A StockFlow B2B é um sistema de gestão de estoque, endereçamento de armazém e
              comercialização entre empresas (B2B). Ela permite que a empresa administradora
              cadastre produtos e preços, e que empresas clientes cadastradas solicitem cotações e
              façam pedidos dentro das condições comerciais configuradas.
            </p>
          </Section>

          <Section title="2. Cadastro e responsabilidade pela conta">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>O cadastro de uma empresa cliente passa por validação antes da ativação.</li>
              <li>
                Cada empresa é responsável por manter a confidencialidade das credenciais de
                acesso de seus usuários e por toda ação realizada através deles.
              </li>
              <li>
                O uso deve ser exclusivo para os fins comerciais da relação entre a empresa
                administradora e a empresa cliente cadastrada.
              </li>
            </ul>
          </Section>

          <Section title="3. Preços, cotações e pedidos">
            <p>
              Preços de tabela, descontos por quantidade e ofertas exibidos na plataforma são
              configurados pela empresa administradora e podem ser alterados. Uma cotação
              proposta ou um pedido confirmado refletem exatamente a condição vigente no momento
              da ação — nenhum valor é aplicado retroativamente sem acordo entre as partes.
            </p>
          </Section>

          <Section title="4. Disponibilidade do serviço">
            <p>
              A plataforma é fornecida &ldquo;como está&rdquo;, sem garantia de disponibilidade
              ininterrupta. Manutenções, atualizações e eventuais indisponibilidades podem
              ocorrer.
            </p>
          </Section>

          <Section title="5. Uso indevido">
            <p>
              É proibido tentar acessar dados de outra empresa cliente, contornar os controles de
              permissão do sistema, ou usar a plataforma para qualquer finalidade ilícita.
            </p>
          </Section>

          <Section title="6. Alterações destes termos">
            <p>
              Estes termos podem ser atualizados. O uso continuado da plataforma após uma
              atualização implica concordância com a versão vigente.
            </p>
          </Section>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
      <div className="mt-2 text-text-muted">{children}</div>
    </section>
  );
}
