# Roadmap StockFlow B2B

Desenvolvimento em fases (§50 do briefing). Cada fase entrega algo real e
testável — sem dados simulados apresentados como reais, sem botões sem
função.

- [x] **Fase 1 — Arquitetura + banco + autenticação.** Schema multiempresa,
      RBAC completo (papéis + permissões seedados), sessão segura,
      registro de empresa cliente, convite de usuário, aprovação/bloqueio
      de empresa cliente, auditoria, dashboard mínimo, testes automatizados.
- [ ] **Fase 2 — Cadastro de produtos + estoque.** `Product`, `Category`,
      `Inventory`, `InventoryMovement`. Tela de Produtos e Estoque deixam de
      ser placeholder.
- [ ] **Fase 3 — Armazém + posições.** `Warehouse`, `WarehouseArea`,
      `StorageLocation`, endereçamento (`A-03-R12-N04-P08`), mapa visual,
      indicador de posições fora do padrão.
- [ ] **Fase 4 — ABC/XYZ + Smart Stock Engine.** Classificação automática,
      índice de prioridade de redução, pesos configuráveis, central de
      alertas.
- [ ] **Fase 5 — Catálogo B2B.** Navegação pública/portal de produtos,
      especificações técnicas, documentos, filtros.
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
