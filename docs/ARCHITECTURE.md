# StockFlow B2B — Arquitetura

> Documento de referência solicitado antes do desenvolvimento (visão geral,
> páginas, banco, fluxos, permissões, segurança, estoque, preço, ofertas,
> ABC/XYZ, dashboards, integrações e roadmap). A Fase 1 (arquitetura + banco
> + autenticação) já está implementada; as demais fases evoluem este
> documento incrementalmente — ele descreve tanto o que existe hoje quanto o
> plano para o que vem a seguir, e cada seção diz qual é qual.

## 1. Arquitetura geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js (App Router)                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │
│  │  Marketing /   │  │  /admin        │  │  /portal           │    │
│  │  Auth pages    │  │  (React Server │  │  (React Server     │    │
│  │  (client forms │  │  Components)   │  │  Components)        │    │
│  │  + API routes) │  │                │  │                     │    │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬──────────┘    │
│          │                   │                       │             │
│          ▼                   ▼                       ▼             │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │        Route Handlers (API) + Server Actions               │   │
│   │  auth · rbac · rate limiting · csrf · audit · validation   │   │
│   └───────────────────────────┬──────────────────────────────┘   │
│                                │ Prisma Client                     │
└────────────────────────────────┼───────────────────────────────────┘
                                  ▼
                        ┌───────────────────┐
                        │   PostgreSQL        │
                        └───────────────────┘
```

Camadas (todas hoje dentro do monólito Next.js, mas isoladas em módulos
próprios para poderem virar serviços independentes sem reescrever regra de
negócio):

- **Apresentação** — `src/app/**` (Server Components por padrão; Client
  Components só onde há interação: formulários, dropdowns, drawers).
- **API/Ações** — `src/app/api/**/route.ts` (endpoints públicos: login,
  registro, sessão, redefinição de senha) e Server Actions colocalizadas com
  cada página administrativa/portal (`actions.ts`), sempre com verificação
  de permissão no próprio arquivo de ação — nunca só na tela.
- **Domínio/serviços de servidor** — `src/server/**`: `auth` (sessão, senha,
  RBAC, CSRF, rate limit), `audit`, `notifications` (stub de e-mail,
  claramente marcado como integração pendente), `tenant`, `http`.
- **Acesso a dados** — `src/server/db/client.ts` (Prisma singleton) +
  `prisma/schema.prisma`.
- **Proxy/Edge** — `src/proxy.ts` (antigo "middleware"): só verifica a
  presença do cookie de sessão e aplica cabeçalhos de segurança; nunca é a
  autoridade de autorização.

Módulos que ainda não existem (Fases 2+) seguem a mesma divisão: cada motor
de negócio (Smart Stock Engine, Pricing Engine, Offer Engine) vive em
`src/server/<domínio>/` com suas próprias regras, testável isoladamente da
camada HTTP.

## 2. Mapa de páginas

**Público / autenticação** (`/`, `/login`, `/register`, `/forgot-password`,
`/reset-password`) — implementado na Fase 1.

**Administrativo** (`/admin/**`, acesso apenas para `userType=INTERNAL`):
Dashboard, Estoque, Produtos, Categorias, Armazém, Posições, Ofertas,
Preços, Pedidos, Cotações, Clientes, Empresas, Usuários, Funcionários,
Logística, Relatórios, Analytics, Alertas, Auditoria, Configurações,
Integrações — a navegação completa já existe (`ADMIN_NAV`), mas cada item
só fica com o módulo funcional a partir da fase indicada no menu; os demais
mostram um estado vazio explícito ("módulo ainda não implementado — Fase
N"), nunca dados simulados como se fossem reais.

**Portal do cliente** (`/portal/**`, acesso apenas para `userType=CLIENT`):
Início, Produtos, Ofertas, Meus pedidos, Cotações, Carrinho, Minha empresa,
Suporte. "Minha empresa" é funcional desde a Fase 1; "Produtos" é funcional
desde a Fase 2 (consulta ao catálogo, somente disponibilidade comercial —
nunca quantidade interna); os módulos de compra (ofertas, cotação,
carrinho, pedido) aguardam as fases 6–9.

## 3. Arquitetura do banco de dados

PostgreSQL + Prisma. Entidades da Fase 1 (ver `prisma/schema.prisma`):

- `Tenant` — empresa operadora da plataforma (multiempresa, §37).
- `CustomerCompany` — empresa cliente B2B (CNPJ, status de validação).
- `User` — identidade única para funcionários e usuários de clientes
  (`userType: INTERNAL | CLIENT`), sempre vinculado a um `Tenant`.
- `Role` / `Permission` / `RolePermission` — RBAC granular.
- `Session` — sessão opaca revogável no servidor (não é JWT).
- `PasswordResetToken` — também reaproveitado para ativação de convite.
- `LoginAttempt` — throttling de login/registro/redefinição.
- `AuditLog` — trilha append-only de ações sensíveis.
- `SystemSetting` — configuração chave/valor, global ou por tenant.

Entidades das próximas fases (Produto, Inventory, Warehouse,
StorageLocation, StockClassification, Offer, Price, Quote, Order, Payment,
Shipment...) serão adicionadas ao mesmo schema conforme cada fase abre,
sempre com `tenantId` para isolamento multiempresa — nunca todas de uma vez,
para manter cada migração revisável.

## 4. Fluxos de usuário (cliente B2B)

1. Cadastro público (`/register`) → `CustomerCompany` criada com status
   `PENDING_VALIDATION` e usuário `CLIENT_ADMIN` já autenticado.
2. Login (`/login`) → redirecionamento automático para `/portal` (cliente)
   ou `/admin/dashboard` (interno), conforme `userType`.
3. Cliente vê banner de status (aguardando validação / bloqueada / ativa)
   na Home do portal.
4. `CLIENT_ADMIN` convida colegas (`CLIENT_USER`) em "Minha empresa" — o
   convidado recebe um link de definição de senha (reaproveita o fluxo de
   redefinição) e é ativado ao definir a própria senha.
5. A partir da Fase 5+: navegação por catálogo, ofertas, cotação, carrinho e
   pedido, seguindo o fluxo completo do §29 do briefing.

## 5. Fluxos administrativos

1. Time comercial acessa `/admin/clientes`, revisa CNPJ/razão social e
   **aprova** ou **bloqueia** a empresa cliente (Server Action com
   verificação de permissão + auditoria).
2. Administrador convida novos funcionários em `/admin/usuarios`, atribuindo
   uma função (Role) não-cliente; o convidado ativa a própria conta.
3. Toda ação sensível (login, registro, aprovação, convite, redefinição de
   senha) fica visível em `/admin/auditoria`.
4. A partir da Fase 2+: cadastro de produtos → análise do Smart Stock
   Engine → aprovação de oferta → acompanhamento de pedido, conforme o
   fluxo principal do §29.

## 6. Sistema de permissões (RBAC)

Definido uma única vez em `src/lib/permissions.ts` (`PERMISSIONS`,
`ROLES`, `ROLE_DEFINITIONS`) e semeado no banco por `prisma/seed.ts`. Papéis:
`SUPER_ADMIN`, `ADMIN`, `ESTOQUE`, `LOGISTICA`, `COMERCIAL`, `FINANCEIRO`,
`ANALISTA`, `SUPORTE` (internos) e `CLIENT_ADMIN`, `CLIENT_USER` (clientes).

Regra inegociável: **nenhuma tela decide o que o usuário pode fazer** — toda
página/Server Action/rota chama `requirePermission(...)` ou
`getCurrentUser()` e verifica a permissão no servidor, consultando o banco a
cada requisição. A navegação (`ADMIN_NAV`) apenas *oculta* itens sem
permissão por conveniência de UX; a proteção real está nas rotas.

## 7. Arquitetura de segurança

- Senhas com `bcrypt` (12 rounds), nunca texto puro.
- Sessão opaca (token aleatório de 256 bits, hash SHA-256 no banco),
  cookie `HttpOnly` + `SameSite=Lax` + `Secure` em produção — revogável
  instantaneamente (logout, redefinição de senha, bloqueio).
- CSRF via double-submit cookie (`sf_csrf` + cabeçalho `x-csrf-token`) para
  mutações autenticadas fora de Server Actions.
- Rate limiting e bloqueio de conta (5 tentativas → 15 min) persistidos em
  banco, por identificador **e** por IP.
- Validação de entrada com Zod em toda rota pública.
- Cabeçalhos de segurança (`X-Frame-Options`, CSP, `Referrer-Policy`,
  `Permissions-Policy`, HSTS em produção) aplicados no proxy de borda. A CSP
  usa `script-src 'self' 'unsafe-inline'` em vez de nonce por requisição —
  a abordagem por nonce do Next.js exige renderização dinâmica em **todas**
  as rotas (nenhuma página estática), o que desligaria a otimização
  estática do app inteiro; como não há `dangerouslySetInnerHTML` em
  nenhuma tela, o risco residual é limitado.
- Mensagens de erro genéricas onde a especificidade vazaria informação
  (login, registro, redefinição de senha nunca confirmam se um e-mail/CNPJ
  existe).
- Auditoria append-only para toda ação sensível.
- Segredos apenas em variáveis de ambiente (`.env`, nunca commitado — ver
  `.env.example`).

Pendências explícitas para produção (não implementadas ainda, por não
inventar segurança que não existe): MFA/2FA, rate limiter distribuído
(Redis) para múltiplas instâncias, scanner de upload de arquivos.

## 8. Estratégia de estoque

O **Smart Stock Engine** (Fase 4) calculará, por produto: classificação
ABC (financeira/giro) e XYZ (previsibilidade de demanda), e um índice de
prioridade de redução (0–100) a partir de cobertura, giro, espaço ocupado,
idade do estoque e criticidade — com pesos configuráveis pelo
administrador. Nenhum número desse motor é inventado antes de existir
dado real de estoque; o dashboard da Fase 1 deixa isso explícito.

## 9. Estratégia de precificação

O motor de preços (Fase 6) nunca aprova automaticamente uma venda abaixo da
margem mínima configurada por produto; descontos progressivos por
quantidade são configuráveis por produto; exceções abaixo do preço mínimo
exigem aprovação explícita (fluxo de aprovação do §44), sempre auditada.

## 10. Estratégia de ofertas

Ofertas (Fase 6) nascem de excedente identificado pelo Smart Stock Engine,
com meta de redução e acompanhamento de resultado, sem expor ao cliente
dados internos sensíveis (motivo estratégico, custo, posição física).

## 11. Estratégia ABC/XYZ

Ver seção 8. Os filtros de estoque por classe combinada (ex.: `CZ`, `AX`)
serão adicionados junto com o cadastro de produtos e movimentações, quando
houver dado real para classificar.

## 12. Estrutura dos dashboards

- **Fase 1**: dashboard operacional mínimo — contas internas, empresas
  clientes ativas/pendentes, fase atual. Sem métricas de estoque/venda
  simuladas.
- **Fase 10+**: dashboard executivo (§42) com estoque total, estoque
  excedente, posições fora do padrão, ofertas ativas, margem média — todos
  calculados a partir de dado real cadastrado, nunca estimados quando não
  há dado suficiente (§19).

## 13. Integrações

Camada de integração desacoplada (`src/server/notifications`,
futuramente `src/server/integrations/**`). Nenhuma integração externa está
conectada nesta instalação — cada ponto de integração pendente (e-mail
transacional, gateway de pagamento, ERP/WMS, transportadoras) aparece
identificado como "pendente de configuração" em `/admin/configuracoes`, sem
simular envio ou resposta de um provedor real.

## 14. Roadmap

Ver `docs/ROADMAP.md`.
