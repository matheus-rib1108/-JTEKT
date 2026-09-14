/**
 * Canonical permission keys and the role → permission matrix (product brief
 * §26). This file is the single source of truth consumed both by the seed
 * script (prisma/seed.ts) and by server-side authorization checks
 * (src/server/auth/rbac.ts) — never duplicate this list elsewhere.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",

  INVENTORY_VIEW: "inventory:view",
  INVENTORY_MANAGE: "inventory:manage",

  PRODUCTS_VIEW: "products:view",
  PRODUCTS_MANAGE: "products:manage",

  WAREHOUSE_VIEW: "warehouse:view",
  WAREHOUSE_MANAGE: "warehouse:manage",

  OFFERS_VIEW: "offers:view",
  OFFERS_MANAGE: "offers:manage",
  OFFERS_APPROVE: "offers:approve",

  PRICING_VIEW: "pricing:view",
  PRICING_MANAGE: "pricing:manage",
  PRICING_APPROVE_EXCEPTION: "pricing:approve_exception",

  ORDERS_VIEW: "orders:view",
  ORDERS_MANAGE: "orders:manage",

  QUOTES_VIEW: "quotes:view",
  QUOTES_MANAGE: "quotes:manage",

  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",

  EMPLOYEES_VIEW: "employees:view",
  EMPLOYEES_MANAGE: "employees:manage",

  LOGISTICS_VIEW: "logistics:view",
  LOGISTICS_MANAGE: "logistics:manage",

  REPORTS_VIEW: "reports:view",
  ANALYTICS_VIEW: "analytics:view",

  ALERTS_VIEW: "alerts:view",
  ALERTS_MANAGE: "alerts:manage",

  AUDIT_VIEW: "audit:view",

  SETTINGS_VIEW: "settings:view",
  SETTINGS_MANAGE: "settings:manage",

  INTEGRATIONS_VIEW: "integrations:view",
  INTEGRATIONS_MANAGE: "integrations:manage",

  SUPPORT_VIEW: "support:view",
  SUPPORT_MANAGE: "support:manage",

  // Client-portal-scoped permissions (checked against the caller's own
  // tenant/customerCompany — never grant cross-customer visibility).
  CLIENT_PORTAL_ACCESS: "client_portal:access",
  CLIENT_COMPANY_MANAGE: "client_company:manage",
  CLIENT_ORDERS_VIEW: "client_orders:view",
  CLIENT_QUOTES_MANAGE: "client_quotes:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  ESTOQUE: "ESTOQUE",
  LOGISTICA: "LOGISTICA",
  COMERCIAL: "COMERCIAL",
  FINANCEIRO: "FINANCEIRO",
  ANALISTA: "ANALISTA",
  SUPORTE: "SUPORTE",
  CLIENT_ADMIN: "CLIENT_ADMIN",
  CLIENT_USER: "CLIENT_USER",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

interface RoleDefinition {
  name: string;
  description: string;
  isClientRole: boolean;
  permissions: PermissionKey[];
}

const P = PERMISSIONS;

export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  SUPER_ADMIN: {
    name: "Super Administrador",
    description: "Acesso total à plataforma, incluindo todos os tenants.",
    isClientRole: false,
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: "Administrador",
    description: "Gestão completa dentro do próprio tenant.",
    isClientRole: false,
    permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith("client_")),
  },
  ESTOQUE: {
    name: "Estoque",
    description: "Controle de estoque, produtos e posições do armazém.",
    isClientRole: false,
    permissions: [
      P.DASHBOARD_VIEW,
      P.INVENTORY_VIEW,
      P.INVENTORY_MANAGE,
      P.PRODUCTS_VIEW,
      P.PRODUCTS_MANAGE,
      P.WAREHOUSE_VIEW,
      P.WAREHOUSE_MANAGE,
      P.ALERTS_VIEW,
      P.REPORTS_VIEW,
    ],
  },
  LOGISTICA: {
    name: "Logística",
    description: "Pedidos, separação, expedição e transporte.",
    isClientRole: false,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORDERS_VIEW,
      P.LOGISTICS_VIEW,
      P.LOGISTICS_MANAGE,
      P.WAREHOUSE_VIEW,
      P.ALERTS_VIEW,
    ],
  },
  COMERCIAL: {
    name: "Comercial",
    description: "Clientes, preços, ofertas e cotações.",
    isClientRole: false,
    permissions: [
      P.DASHBOARD_VIEW,
      P.CUSTOMERS_VIEW,
      P.CUSTOMERS_MANAGE,
      P.PRICING_VIEW,
      P.PRICING_MANAGE,
      P.OFFERS_VIEW,
      P.OFFERS_MANAGE,
      P.QUOTES_VIEW,
      P.QUOTES_MANAGE,
      P.ORDERS_VIEW,
      P.ALERTS_VIEW,
      P.REPORTS_VIEW,
    ],
  },
  FINANCEIRO: {
    name: "Financeiro",
    description: "Pagamentos, faturamento e relatórios financeiros.",
    isClientRole: false,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORDERS_VIEW,
      P.REPORTS_VIEW,
      P.PRICING_VIEW,
      P.ALERTS_VIEW,
    ],
  },
  ANALISTA: {
    name: "Analista",
    description: "Dashboards e relatórios, somente leitura.",
    isClientRole: false,
    permissions: [P.DASHBOARD_VIEW, P.ANALYTICS_VIEW, P.REPORTS_VIEW, P.INVENTORY_VIEW],
  },
  SUPORTE: {
    name: "Suporte",
    description: "Atendimento a clientes empresariais.",
    isClientRole: false,
    permissions: [P.DASHBOARD_VIEW, P.SUPPORT_VIEW, P.SUPPORT_MANAGE, P.CUSTOMERS_VIEW],
  },
  CLIENT_ADMIN: {
    name: "Administrador da Empresa Cliente",
    description: "Gerencia usuários e dados da própria empresa cliente.",
    isClientRole: true,
    permissions: [
      P.CLIENT_PORTAL_ACCESS,
      P.CLIENT_COMPANY_MANAGE,
      P.CLIENT_ORDERS_VIEW,
      P.CLIENT_QUOTES_MANAGE,
    ],
  },
  CLIENT_USER: {
    name: "Usuário da Empresa Cliente",
    description: "Usuário comum de uma empresa cliente.",
    isClientRole: true,
    permissions: [P.CLIENT_PORTAL_ACCESS, P.CLIENT_ORDERS_VIEW, P.CLIENT_QUOTES_MANAGE],
  },
};
