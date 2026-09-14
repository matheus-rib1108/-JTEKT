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
- [ ] **Fase 5 — Catálogo B2B (completo).** Imagens, documentos técnicos,
      filtros avançados por faixa de preço/aplicação/fabricante — a
      navegação básica já existe desde a Fase 2.
- [ ] **Fase 6 — Ofertas + preços.** Motor de preços com margem/preço
      mínimo, descontos por quantidade, ofertas de estoque excedente.
- [ ] **Fase 7 — Carrinho + pedidos.** `Order`, `OrderItem`, reserva de
      estoque, economia calculada.
- [ ] **Fase 8 — Cotações.** `Quote`, `QuoteItem`, negociação e proposta.
- [ ] **Fase 9 — Logística.** `Shipment`, status de separação/expedição.
- [ ] **Fase 10 — Dashboard executivo + Analytics.**
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
