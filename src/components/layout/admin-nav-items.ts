import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export interface AdminNavItem {
  label: string;
  href: string;
  permission: PermissionKey;
  phase?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Visão geral",
    items: [{ label: "Dashboard", href: "/admin/dashboard", permission: PERMISSIONS.DASHBOARD_VIEW }],
  },
  {
    label: "Estoque",
    items: [
      { label: "Estoque", href: "/admin/estoque", permission: PERMISSIONS.INVENTORY_VIEW },
      { label: "Produtos", href: "/admin/produtos", permission: PERMISSIONS.PRODUCTS_VIEW },
      { label: "Categorias", href: "/admin/categorias", permission: PERMISSIONS.PRODUCTS_VIEW },
      { label: "Armazém", href: "/admin/armazem", permission: PERMISSIONS.WAREHOUSE_VIEW },
      { label: "Posições", href: "/admin/posicoes", permission: PERMISSIONS.WAREHOUSE_VIEW },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Ofertas", href: "/admin/ofertas", permission: PERMISSIONS.OFFERS_VIEW },
      { label: "Preços", href: "/admin/precos", permission: PERMISSIONS.PRICING_VIEW },
      { label: "Pedidos", href: "/admin/pedidos", permission: PERMISSIONS.ORDERS_VIEW },
      { label: "Cotações", href: "/admin/cotacoes", permission: PERMISSIONS.QUOTES_VIEW, phase: "Fase 8" },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { label: "Clientes", href: "/admin/clientes", permission: PERMISSIONS.CUSTOMERS_VIEW },
      { label: "Empresas", href: "/admin/empresas", permission: PERMISSIONS.SETTINGS_VIEW },
      { label: "Usuários", href: "/admin/usuarios", permission: PERMISSIONS.EMPLOYEES_VIEW },
      { label: "Funcionários", href: "/admin/funcionarios", permission: PERMISSIONS.EMPLOYEES_VIEW, phase: "Fase futura" },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Logística", href: "/admin/logistica", permission: PERMISSIONS.LOGISTICS_VIEW, phase: "Fase 9" },
      { label: "Relatórios", href: "/admin/relatorios", permission: PERMISSIONS.REPORTS_VIEW, phase: "Fase 11" },
      { label: "Analytics", href: "/admin/analytics", permission: PERMISSIONS.ANALYTICS_VIEW, phase: "Fase 10" },
      { label: "Alertas", href: "/admin/alertas", permission: PERMISSIONS.ALERTS_VIEW },
    ],
  },
  {
    label: "Governança",
    items: [
      { label: "Auditoria", href: "/admin/auditoria", permission: PERMISSIONS.AUDIT_VIEW },
      { label: "Configurações", href: "/admin/configuracoes", permission: PERMISSIONS.SETTINGS_VIEW },
      { label: "Integrações", href: "/admin/integracoes", permission: PERMISSIONS.INTEGRATIONS_VIEW, phase: "Fase futura" },
    ],
  },
];
