import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = { title: "Política de Privacidade — StockFlow B2B" };

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 text-[14px] leading-relaxed text-foreground">
          <h1 className="text-[24px] font-semibold">Política de Privacidade</h1>
          <p className="mt-2 text-[13px] text-text-muted">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}.
          </p>

          <Notice />

          <Section title="1. Quem coleta os dados">
            <p>
              A StockFlow B2B é operada por cada empresa que instala esta plataforma para gerenciar
              seu próprio estoque, catálogo e relacionamento com clientes B2B. Esta instalação
              específica é mantida por JTEKT (demonstração).
            </p>
          </Section>

          <Section title="2. Quais dados são coletados e por quê">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Cadastro de empresa cliente:</strong> razão social, nome fantasia, CNPJ,
                telefone e endereço — necessários para identificar a empresa compradora e emitir
                pedidos/cotações em nome dela.
              </li>
              <li>
                <strong>Conta de usuário:</strong> nome, e-mail e senha (armazenada com hash
                criptográfico, nunca em texto puro) — necessários para autenticação e para
                registrar quem realizou cada ação no sistema.
              </li>
              <li>
                <strong>Histórico comercial:</strong> pedidos, cotações, preços negociados e
                movimentações de estoque associadas à empresa — necessários para a operação do
                sistema e para a trilha de auditoria.
              </li>
              <li>
                <strong>Dados técnicos de acesso:</strong> endereço IP e horário de cada ação
                sensível (login, alteração de preço, aprovação, exportação de relatório) —
                registrados na Auditoria para segurança e rastreabilidade, nunca para perfilamento
                comercial.
              </li>
            </ul>
          </Section>

          <Section title="3. Cookies">
            <p>
              Dois cookies são usados, ambos estritamente necessários para o funcionamento do
              sistema — nenhum cookie de rastreamento ou publicidade é usado:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Sessão de login (identifica sua conta autenticada; expira em 12 horas).</li>
              <li>Token de proteção contra CSRF (impede que outro site execute ações em seu nome).</li>
            </ul>
          </Section>

          <Section title="4. Compartilhamento com terceiros">
            <p>
              Arquivos enviados (imagens e documentos de produto) podem ser armazenados em um
              serviço de object storage em nuvem (Vercel Blob) quando configurado, ou em disco
              local nesta instalação. O hospedeiro da aplicação e do banco de dados também tem
              acesso técnico à infraestrutura como parte da operação do serviço. Nenhum dado é
              vendido ou compartilhado para fins de marketing.
            </p>
          </Section>

          <Section title="5. Retenção e exclusão">
            <p>
              Dados de conta e histórico comercial são mantidos enquanto a empresa cliente
              mantiver acesso ativo à plataforma, e por período adicional quando exigido para
              cumprir obrigação legal ou resguardar direito em processo (ex.: histórico de
              auditoria). Para solicitar acesso, correção ou exclusão dos seus dados, entre em
              contato com o administrador desta instalação. Esta plataforma ainda não oferece um
              mecanismo de autoatendimento para exclusão de conta — o pedido é tratado
              manualmente.
            </p>
          </Section>

          <Section title="6. Seus direitos (LGPD)">
            <p>
              A Lei Geral de Proteção de Dados (Lei 13.709/2018) garante, entre outros, os
              direitos de confirmação de tratamento, acesso, correção, anonimização, portabilidade
              e eliminação dos dados. Solicitações podem ser feitas ao administrador da
              instalação através do contato informado no rodapé.
            </p>
          </Section>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Notice() {
  return (
    <div className="mt-6 rounded-[var(--radius-md)] border border-warning-600/40 bg-warning-100 p-4 text-[13px] text-warning-700">
      Este texto descreve, de forma factual, o que o sistema efetivamente faz com os dados que
      coleta. Ele não substitui uma revisão jurídica formal — antes de operar com clientes reais,
      recomenda-se que um advogado especializado em proteção de dados revise e adapte este
      documento à operação real da empresa.
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
