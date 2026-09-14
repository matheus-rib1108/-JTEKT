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
- [ ] **Fase 11 — Relatórios.** Exportação CSV/Excel/PDF.
- [ ] **Fase 12 — Segurança + auditoria avançada.** MFA/2FA, aprovação
      multi-etapa, rate limiter distribuído.
- [ ] **Fase 13 — Testes.** Cobertura de integração/E2E dos fluxos
      comerciais completos.
- [ ] **Fase 14 — Performance.**
- [ ] **Fase 15 — Deploy.**

## Débitos técnicos conhecidos (declarados, não escondidos)

- Rate limiting hoje é por banco de dados; sob múltiplas instâncias, migrar
  para um contador compartilhado (Redis).
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
