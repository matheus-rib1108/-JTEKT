import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";
import { registerCompanySchema } from "@/lib/validation/auth";
import { hashPassword } from "@/server/auth/password";
import { attachSessionCookies, createSession } from "@/server/auth/session";
import { getRequestIp } from "@/server/http/ip";
import { writeAuditLog } from "@/server/audit/log";
import { ROLES } from "@/lib/permissions";
import { getDefaultTenant } from "@/server/tenant/default";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const ip = getRequestIp(request);

  const tenant = await getDefaultTenant();
  if (!tenant) {
    return NextResponse.json(
      { error: "Cadastro de empresas temporariamente indisponível." },
      { status: 503 },
    );
  }

  const existingCompany = await prisma.customerCompany.findUnique({
    where: { tenantId_cnpj: { tenantId: tenant.id, cnpj: data.cnpj } },
  });
  const existingUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: data.adminEmail },
  });

  // Generic conflict message on purpose — do not reveal which field (CNPJ
  // vs. e-mail) already exists, to avoid enumerating registered companies.
  if (existingCompany || existingUser) {
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro com os dados informados." },
      { status: 409 },
    );
  }

  const clientAdminRole = await prisma.role.findUnique({ where: { key: ROLES.CLIENT_ADMIN } });
  if (!clientAdminRole) {
    return NextResponse.json(
      { error: "Cadastro de empresas temporariamente indisponível." },
      { status: 503 },
    );
  }

  const passwordHash = await hashPassword(data.password);

  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.customerCompany.create({
      data: {
        tenantId: tenant.id,
        legalName: data.companyLegalName,
        tradeName: data.companyTradeName || null,
        cnpj: data.cnpj,
        phone: data.phone || null,
        status: "PENDING_VALIDATION",
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        userType: "CLIENT",
        customerCompanyId: company.id,
        name: data.adminName,
        email: data.adminEmail,
        passwordHash,
        roleId: clientAdminRole.id,
        status: "ACTIVE",
      },
    });

    return { company, user };
  });

  const { rawToken, expiresAt } = await createSession({
    userId: user.id,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });
  const cookieStore = await cookies();
  attachSessionCookies(cookieStore, rawToken, expiresAt);

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: user.id,
    action: "customer_company.register",
    entityType: "CustomerCompany",
    entityId: company.id,
    ipAddress: ip,
    afterData: { legalName: company.legalName, cnpj: company.cnpj },
  });

  return NextResponse.json(
    {
      user: { id: user.id, name: user.name, email: user.email, roleKey: clientAdminRole.key },
      company: { id: company.id, status: company.status },
    },
    { status: 201 },
  );
}
