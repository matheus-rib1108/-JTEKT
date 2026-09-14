export interface PortalNavItem {
  label: string;
  href: string;
  phase?: string;
}

export const PORTAL_NAV: PortalNavItem[] = [
  { label: "Início", href: "/portal" },
  { label: "Produtos", href: "/portal/produtos" },
  { label: "Ofertas", href: "/portal/ofertas" },
  { label: "Meus pedidos", href: "/portal/pedidos", phase: "Fase 7" },
  { label: "Cotações", href: "/portal/cotacoes", phase: "Fase 8" },
  { label: "Carrinho", href: "/portal/carrinho", phase: "Fase 7" },
  { label: "Minha empresa", href: "/portal/conta" },
  { label: "Suporte", href: "/portal/suporte", phase: "Fase futura" },
];
