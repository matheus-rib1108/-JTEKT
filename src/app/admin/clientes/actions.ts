"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getIpFromHeaders(): Promise<string | null> {
  const headerList = await headers();
  return getRequestIp(new Request("http://localhost", { headers: headerList }));
}

export async function approveCustomerCompany(companyId: string): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const company = await prisma.customerCompany.findFirst({
    where: { id: companyId, tenantId: auth.user.tenantId },
  });
  if (!company) return { ok: false, error: "Empresa não encontrada." };

  await prisma.customerCompany.update({
    where: { id: companyId },
    data: { status: "ACTIVE", approvedAt: new Date(), approvedById: auth.user.id },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "customer_company.approve",
    entityType: "CustomerCompany",
    entityId: companyId,
    ipAddress: await getIpFromHeaders(),
    beforeData: { status: company.status },
    afterData: { status: "ACTIVE" },
  });

  revalidatePath("/admin/clientes");
  return { ok: true };
}

export async function blockCustomerCompany(companyId: string): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const company = await prisma.customerCompany.findFirst({
    where: { id: companyId, tenantId: auth.user.tenantId },
  });
  if (!company) return { ok: false, error: "Empresa não encontrada." };

  await prisma.customerCompany.update({
    where: { id: companyId },
    data: { status: "BLOCKED" },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "customer_company.block",
    entityType: "CustomerCompany",
    entityId: companyId,
    ipAddress: await getIpFromHeaders(),
    beforeData: { status: company.status },
    afterData: { status: "BLOCKED" },
  });

  revalidatePath("/admin/clientes");
  return { ok: true };
}
