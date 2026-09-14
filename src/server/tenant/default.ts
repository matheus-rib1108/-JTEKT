import "server-only";
import { prisma } from "@/server/db/client";

const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "jtekt";

/**
 * Single-tenant bootstrap helper. The schema already supports multiple
 * tenants (§37), but until a second tenant actually onboards there is no
 * tenant-selection UI, so every public entry point (registration, and
 * eventually storefront browsing) resolves against this one. Revisit when
 * a second tenant is provisioned.
 */
export async function getDefaultTenant() {
  return prisma.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
}
