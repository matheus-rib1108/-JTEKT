# Roadmap StockFlow B2B

Desenvolvimento em fases (§50 do briefing). Cada fase entrega algo real e
testável — sem dados simulados apresentados como reais, sem botões sem
função.

- [x] **Fase 1 — Arquitetura + banco + autenticação.** Schema multiempresa,
      RBAC completo (papéis + permissões seedados), sessão segura,
      registro de empresa cliente, convite de usuário, aprovação/bloqueio
      de empresa cliente, auditoria, dashboard mínimo, testes automatizados.
- [x] **Fase 2 — Cadastro de produtos + estoque.** `Category`, `Product`,
      `Inventory`, `InventoryMovement`. Categorias, Produtos e Estoque
      deixaram de ser placeholder: CRUD de categorias e produtos
      (especificações técnicas livres), motor de movimentação de estoque
      (entrada/saída/ajuste/reserva/bloqueio) com validação de limites e
      ledger append-only, separação estoque interno × comercial (§9), e
      consulta de catálogo no portal do cliente (só o que a Fase 5
      completa: cotação/carrinho/pedido, ainda faltam).
- [x] **Fase 3 — Armazém + posições.** `Warehouse`, `StorageLocation`,
      `ProductStorageLocation`. Endereçamento físico (`A-03-R12-N04-P08`,
      gerado em lote por corredor/rack), mapa visual clicável por posição
      (status derivado da alocação — nunca setado à mão para
      disponível/ocupada), alocação de produto por posição com limite
      contra o estoque em mãos, e o indicador de posições fora do padrão
      (§17) com meta configurável, progresso e histórico de correções via
      auditoria.
- [x] **Fase 4 — ABC/XYZ + Smart Stock Engine.** `StockClassification`,
      `Alert`. Classificação ABC por Pareto de valor parado (onHand ×
      `unitCost`, novo campo — não é o motor de preços da Fase 6), XYZ por
      coeficiente de variação do consumo dos últimos 6 meses, índice de
      prioridade de redução 0-100 com pesos configuráveis pelo
      administrador e amortecimento para itens classe A. Central de
      alertas real (estoque abaixo/acima do limite, sem movimentação,
      muitas posições ocupadas, posição fora do padrão), gerada e
      resolvida automaticamente a cada recálculo. Nunca fabrica uma classe
      quando falta dado real (custo não cadastrado → ABC "N/D"; menos de 3
      períodos de consumo → XYZ "N/D").
- [x] **Fase 5 — Catálogo B2B (completo).** `ProductImage`, `ProductDocument`,
      novo campo `application` (§10/§60 "Aplicação: Automotiva/Industrial").
      Upload local validado por MIME real (nunca pela extensão informada
      pelo usuário) com limite de tamanho por tipo, ou colagem de URL
      externa — sem integração de object storage configurada, sinalizado
      em código em vez de simulado (§49); troca para S3/Blob é pré-
      requisito de produção multi-instância. Painéis de imagens/documentos
      na página do produto (admin), filtros por fabricante/aplicação no
      catálogo do admin e do portal do cliente, miniaturas na listagem, e
      nova página de detalhe técnico do produto no portal (galeria,
      especificações, documentos para download) — sem nenhum campo de
      quantidade interna exposto ao cliente (§9). Dois bugs achados só em
      teste real de navegador: CSP `img-src` bloqueava silenciosamente
      imagens externas coladas pelo admin (faltava `https:`), e o
      armazenamento em disco disparava um warning de build do Turbopack por
      montar o caminho via split/join de string em vez de segmentos
      literais.
- [x] **Fase 6 — Ofertas + preços.** `ProductPricing`, `PriceTier`, `Offer`.
      Preço de lista e preço mínimo (margem) por produto; um preço de lista
      abaixo do mínimo exige um usuário com `pricing:approve_exception` e um
      motivo obrigatório — nunca aprovado automaticamente, sempre auditado
      (`pricing.min_price_exception`). Faixas de desconto progressivo por
      quantidade, revalidadas contra o preço mínimo atual a cada nova faixa
      (não apenas no momento em que a faixa foi criada). Ofertas nascem
      vinculadas a um produto com preço configurado, nunca podem resultar em
      preço abaixo do mínimo (sem exceção nesse ponto), ficam como rascunho
      até aprovação explícita (`offers:approve`, separada de
      `offers:manage`), e seu progresso é sempre calculado a partir do
      estoque real (`Inventory.quantityOnHand`) desde o início da oferta —
      nunca estimado pelo tempo decorrido. Portal do cliente: página de
      Ofertas e preço/faixas na página de produto, sem nenhum dado interno
      (motivo estratégico, estoque inicial, posição) exposto (§9/§10).
- [x] **Fase 7 — Carrinho + pedidos.** `Order`, `OrderItem` (+
      `CLIENT_ORDERS_MANAGE`, distinta de `CLIENT_ORDERS_VIEW` como todo par
      view/manage do resto do RBAC). O carrinho é o próprio `Order` em
      status `DRAFT` — uma linha por `CustomerCompany`, compartilhada por
      todos os usuários da empresa. Preço unitário e preço de lista são
      congelados em cada item no momento em que ele é adicionado/atualizado
      (nunca recalculados depois), o que torna a "economia calculada" uma
      subtração real entre dois números guardados, não uma estimativa.
      Oferta ativa sempre vence a faixa de desconto por quantidade — regra
      explícita, não "o que for menor". Finalizar o carrinho reserva estoque
      de verdade reaproveitando o próprio ledger de movimentações da Fase 2
      (`RESERVA`), em uma única transação cobrindo todos os itens — se um
      item não tiver saldo, nenhum é reservado. Cancelar um pedido libera a
      reserva (`LIBERACAO_RESERVA`). Admin: página Pedidos (confirmar/cancelar,
      permissão `orders:manage` restrita a ADMIN/SUPER_ADMIN por ora).
      Portal: Carrinho, Meus pedidos, e "Adicionar ao carrinho" na página de
      produto.
- [x] **Fase 8 — Cotações.** `Quote`, `QuoteItem` (§29 "negociação e
      proposta"). O cliente solicita uma cotação a partir da página de um
      produto (quantidade, preço desejado opcional, mensagem); a equipe
      comercial responde com uma proposta — nunca abaixo do preço mínimo
      configurado do produto, mesma regra de piso de preços/ofertas, sem
      exceção nesse ponto (diferente do fluxo de exceção do preço de
      lista). Aceitar uma proposta pula o carrinho e cria o pedido
      diretamente no preço negociado, reservando estoque real do mesmo jeito
      que finalizar o carrinho (`RESERVA`, revalidado contra o estoque atual
      no momento da aceitação, já que a disponibilidade pode ter mudado
      desde a proposta). Rejeitar ou cancelar não move estoque. Admin:
      páginas Cotações (lista + detalhe com formulário de resposta). Portal:
      página Cotações (aceitar/rejeitar/cancelar) e "Solicitar cotação" na
      página de produto.
- [x] **Fase 9 — Logística.** `Shipment` (§9 "separação/expedição").
      Criado só por uma ação explícita da equipe de logística ("Iniciar
      separação" num pedido confirmado) — nunca automaticamente ao
      confirmar, já que separar é uma ação física real. Progride
      linearmente: em separação → embalado → despachado → entregue.
      Transportadora e código de rastreio são campos manuais — nenhuma
      integração de transportadora está conectada nesta instalação (§49).
      No despacho, a reserva de estoque feita no envio do pedido (Fase 7)
      é finalmente convertida em saída real: libera a reserva
      (`LIBERACAO_RESERVA`) e registra a saída física (`SAIDA`) do mesmo
      item, mesma transação — sem isso, todo pedido entregue deixaria
      estoque reservado para sempre sem nunca sair de `quantityOnHand`.
      Portal do cliente vê o status e a transportadora/rastreio em Meus
      pedidos.
- [x] **Fase 10 — Dashboard executivo + Analytics.** (§42/§19). Dashboard
      reescrito com KPIs reais: valor total em estoque, estoque excedente
      (produtos com prioridade de redução ≥ 70), posições fora do padrão,
      ofertas ativas, margem média (lista vs. custo), pedidos em aberto e
      economia concedida a clientes — todos calculados a partir de dado já
      cadastrado, "N/D" em vez de estimativa quando falta custo ou preço.
      Analytics: valor parado por classe ABC, posições por status,
      top 10 produtos por valor parado, margem por produto, e evolução
      mensal de pedidos — sem biblioteca de gráficos (tabelas), e sem
      preencher a evolução mensal artificialmente quando ainda não há
      pedidos reais suficientes.
- [x] **Fase 11 — Relatórios.** Exportação de Estoque e Pedidos
      (`reports:view`) e Auditoria (`audit:view`, mesma permissão da
      própria página de Auditoria — exportar nunca abre uma porta mais
      larga do que visualizar na tela) em CSV real (com BOM UTF-8 para
      abrir acentuação corretamente no Excel), XLSX real via `exceljs`, e
      PDF real via `pdfkit` — três bibliotecas escolhidas por não
      precisarem de binário nativo. Cada relatório busca os dados reais já
      cadastrados no momento do download; nenhum é gerado a partir de
      número simulado, e um relatório sem dados (ex.: nenhum pedido ainda)
      baixa honestamente só o cabeçalho, não uma linha de exemplo
      inventada.
- [x] **Fase 12 — Segurança + auditoria avançada.** MFA/2FA real via TOTP
      (RFC 6238, `otpauth` + `qrcode`): segredo gerado no servidor, QR code
      e chave manual exibidos uma única vez durante o cadastro, e só é
      gravado no banco (criptografado em repouso com AES-256-GCM, chave
      derivada de `APP_SECRET` via scrypt) depois que o usuário prova posse
      digitando um código válido — nada é persistido antes disso. Login
      passa a ter duas etapas quando MFA está ativo: a senha correta gera
      um `MfaChallenge` de uso único (5 min) em vez de sessão, e só a
      confirmação do código de 6 dígitos cria a sessão de verdade; tentativas
      de código reaproveitam o mesmo limitador de força bruta por
      identificador (`LoginAttempt`) já usado no login por senha.
      Aprovação em duas pessoas para ativação de empresa cliente (§12/§26):
      um administrador revisa (`reviewedById`), e só um administrador
      *diferente* pode aprovar — a mesma pessoa nunca pode fazer as duas
      etapas sozinha, verificado no servidor (não só escondendo o botão na
      tela: testado diretamente reproduzindo a chamada da Server Action com
      a sessão de quem revisou, e o servidor recusa mesmo assim).
      "Rate limiter distribuído" fica como débito técnico conhecido — exige
      um contador compartilhado (Redis) não provisionado neste ambiente; já
      listado abaixo, não fabricado.
- [x] **Fase 13 — Testes.** Cobertura de integração/E2E dos fluxos
      comerciais completos, real: `@playwright/test` (`e2e/`, `npm run
      test:e2e`) roda contra um `next dev` real e o Postgres real, sem
      mocks — substitui os scripts descartáveis de smoke test usados nas
      fases anteriores por uma suíte permanente e repetível. Três
      cenários: `commercial-flow.spec.ts` (cadastro → aprovação em duas
      pessoas → carrinho → pedido → separação → embalagem → despacho →
      entrega, com asserção nos movimentos de estoque de verdade, não só no
      texto da tela — a mesma checagem que originalmente pegou o bug do
      `markShipped` na Fase 9); `quotes.spec.ts` (cotação solicitada →
      proposta acima do piso → aceite → cancelamento, liberando a reserva
      pelo fluxo real); `mfa-login.spec.ts` (ativar TOTP, login exigindo o
      código, desativar). Um segundo administrador demo (`comercial@jtekt.demo`,
      role COMERCIAL) foi adicionado ao `prisma/seed.ts` — sem ele não havia
      como demonstrar de verdade a aprovação em duas pessoas da Fase 12.
      Também adicionados: testes unitários que faltavam para lógica pura
      já existente (`mfaCrypto`, esquemas de validação de MFA, `toCsv`).
      Descoberto e corrigido nesta fase: a limpeza de dados de teste
      apagava a empresa cliente diretamente quando um cenário falhava no
      meio do fluxo — como `CustomerCompany → Order` é `onDelete: Cascade`,
      isso apagava o pedido junto e deixava a reserva de estoque órfã (a
      mesma classe de bug já documentada abaixo em "Débitos técnicos
      conhecidos"); a limpeza agora sempre libera a reserva antes de
      apagar. Nota honesta: `commercial-flow.spec.ts` despacha um pedido de
      verdade a cada execução, então `quantityOnHand` do produto usado cai
      de verdade a cada rodada — esperado (é o ponto do teste), mas uma
      suíte de CI que rode isso com frequência precisa re-semear o banco
      entre execuções, não compartilhar um banco que só diminui.
- [x] **Fase 14 — Performance.** Auditoria dirigida a padrões de uso real
      (não otimização especulativa), com achados verificados linha a linha
      antes de qualquer mudança:
      1. `getCurrentUser()`/`getSessionByRawToken` (o join Session → User →
         Role → RolePermission → Permission mais pesado da aplicação)
         agora usam `cache()` do React — antes rodava 2-3x por requisição
         (layout + cada página chamando `requirePermission` de novo),
         agora no máximo uma vez por requisição.
      2. Índices que faltavam para colunas realmente filtradas/ordenadas:
         `Product` (`manufacturer`, `application` — usadas em `where`,
         `distinct` e `orderBy` em toda visita ao catálogo, admin e portal)
         e `LoginAttempt.ipAddress` (o próprio caminho quente do rate
         limiter por IP, sem índice até agora).
      3. `take` adicionado em listagens sem limite que crescem com o
         catálogo/histórico (`admin/estoque`, `admin/ofertas`,
         `admin/clientes`, `portal/ofertas`, `portal/cotacoes`) — e as
         consultas de pedidos em Dashboard/Analytics tiveram o `include`
         trocado por `select` mínimo (só os campos usados no cálculo),
         reduzindo o volume de dados sem mudar o que "histórico completo"
         de fato promete na tela (decidido não limitar essas duas por data,
         já que os rótulos afirmam explicitamente ser o histórico
         completo).
      4. Duas varreduras sequenciais (`runSmartStockEngine`/`generateAlerts`
         em `src/server/analytics/engine.ts`, um upsert por produto/alerta
         em loop `await`) agora disparam com `Promise.all` em vez de uma
         chamada por vez.
      5. `bulkGeneratePositions` (`src/server/warehouse/engine.ts`) fazia um
         `findUnique` + `create` por posição dentro do loop; reescrito para
         um único `findMany` (códigos já existentes) seguido de um único
         `createMany` — testado manualmente (gerar 6 posições novas, depois
         gerar o mesmo lote de novo confirmando "0 criadas, 6 já existiam").
      Deliberadamente fora do escopo desta fase (custo/risco não valem a
      pena agora, registrado como débito técnico): reescrever os loops
      `await` por item dentro das transações de `submitOrder`/`cancelOrder`/
      `markShipped` — são sensíveis a corretude do livro de estoque e só
      importariam de verdade em pedidos com dezenas de itens, o que não é
      o perfil atual de uso.
- [x] **Fase 15 — Deploy.** Alvo escolhido pelo usuário: Vercel. Guia
      completo em `docs/DEPLOY.md` (banco Postgres, Blob Store, variáveis
      de ambiente, primeiro deploy, pós-deploy) — os passos que dependem da
      conta Vercel do usuário (criar projeto, provisionar Postgres/Blob)
      não podem ser feitos por esta sessão, então o trabalho aqui é deixar
      o repositório pronto e documentar exatamente o que falta clicar.
      Mudanças reais no código:
      - Upload de imagens/documentos de produto (`src/server/uploads/storage.ts`)
        migrado para Vercel Blob quando `BLOB_READ_WRITE_TOKEN` está
        configurado — escolha do usuário depois de eu apontar que o disco
        local (usado desde a Fase 5) não sobrevive a uma função serverless.
        Sem o token, cai para o disco local automaticamente (dev local
        continua funcionando sem precisar de um Blob Store); testado
        manualmente nos dois casos.
      - `prisma/schema.prisma`: `directUrl` adicionado ao datasource — em
        produção, `DATABASE_URL` é a conexão via pool (PgBouncer/Neon/etc,
        necessária porque funções serverless abrem muito mais conexões que
        um servidor único) e `DIRECT_URL` é a conexão direta que só
        `prisma migrate` usa. Localmente as duas apontam para o mesmo
        Postgres.
      - `postinstall: prisma generate` adicionado ao `package.json` — não
        depender do preset da Vercel rodar isso implicitamente.
      - `.env.example` atualizado com `DIRECT_URL` e `BLOB_READ_WRITE_TOKEN`.
      Migrations em produção são deliberadamente um passo manual
      (`prisma migrate deploy`, documentado no guia) e não parte do comando
      de build — rodar migration automaticamente a cada build é arriscado
      sob deploys concorrentes.

## Débitos técnicos conhecidos (declarados, não escondidos)

- Rate limiting hoje é por banco de dados; sob múltiplas instâncias, migrar
  para um contador compartilhado (Redis).
- `submitOrder`/`cancelOrder` (`src/server/orders/engine.ts`) e
  `markShipped` (`src/server/logistics/engine.ts`) escrevem a reserva/saída
  de cada item do pedido em um loop `await` sequencial dentro da própria
  transação — corretude do livro de estoque prevalece sobre paralelizar
  aqui (Fase 14); só passa a valer a pena revisitar se pedidos com dezenas
  de itens de linha se tornarem comuns.
- Login resolve o e-mail sem seletor de tenant — correto enquanto existir
  um único tenant; precisa de resolução por subdomínio/seletor antes do
  segundo tenant entrar em operação (§37).
- E-mail transacional é um stub que apenas registra a intenção de envio
  (`src/server/notifications/email.ts`) — nenhum provedor real está
  conectado.
- Uma oferta cujo desconto ficou inválido após uma alta no preço mínimo do
  produto só pode ser encerrada e recriada; não há um fluxo de edição
  direta ainda (avaliar se compensa antes da Fase 7).
- Cancelar um pedido libera a reserva de estoque (`LIBERACAO_RESERVA`), mas
  `quantityAvailableToSell` não é automaticamente restaurado — só o clamp
  genérico de `applyMovementToSnapshot` (que apenas reduz, nunca aumenta de
  volta) se aplica, igual a todo outro tipo de movimento. Uma tentativa de
  "devolver a quantidade liberada" foi implementada e removida ainda nesta
  fase: quando já havia folga entre `quantityAvailableToSell` e o estoque
  livre antes da reserva, ela devolvia mais do que deveria (verificado ao
  testar) — não há como restaurar corretamente sem guardar o valor de
  antes da própria reserva, o que hoje não é registrado em nenhum lugar.
  Ficar subestimado é o lado seguro (nunca vende acima do físico); o admin
  corrige na hora em "Disponibilidade comercial" quando precisar.
