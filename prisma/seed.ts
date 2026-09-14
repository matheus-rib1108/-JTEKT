import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS, type RoleKey } from "../src/lib/permissions";

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "jtekt";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@jtekt.demo";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "TrocarSenha#2026";

async function main() {
  console.log("Seeding permissions...");
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  console.log("Seeding roles...");
  for (const [roleKey, definition] of Object.entries(ROLE_DEFINITIONS) as [RoleKey, (typeof ROLE_DEFINITIONS)[RoleKey]][]) {
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: definition.name, description: definition.description, isClientRole: definition.isClientRole },
      create: {
        key: roleKey,
        name: definition.name,
        description: definition.description,
        isClientRole: definition.isClientRole,
      },
    });

    const permissionRows = await prisma.permission.findMany({
      where: { key: { in: definition.permissions } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissionRows.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log("Seeding default tenant...");
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT_SLUG },
    update: {},
    create: {
      slug: DEFAULT_TENANT_SLUG,
      name: "JTEKT (demonstração)",
      cnpj: "00000000000000",
      status: "ACTIVE",
    },
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });

  const existingAdmin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: SEED_ADMIN_EMAIL },
  });

  if (!existingAdmin) {
    console.log(`Creating demo Super Admin: ${SEED_ADMIN_EMAIL}`);
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        userType: "INTERNAL",
        name: "Administrador StockFlow",
        email: SEED_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 12),
        roleId: superAdminRole.id,
        status: "ACTIVE",
      },
    });
    console.log(`Demo credentials -> ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
  } else {
    console.log("Demo Super Admin already exists, skipping.");
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
