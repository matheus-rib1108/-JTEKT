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

  let adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: SEED_ADMIN_EMAIL },
  });

  if (!adminUser) {
    console.log(`Creating demo Super Admin: ${SEED_ADMIN_EMAIL}`);
    adminUser = await prisma.user.create({
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

  await seedDemoCatalog(tenant.id, adminUser.id);

  console.log("Seed completed.");
}

/**
 * Demonstration catalog (§69: realistic naming, clearly a demo tenant —
 * "JTEKT (demonstração)" — never presented as production data). Inserted
 * directly via Prisma rather than through src/server/inventory/engine.ts
 * because that module imports "server-only", which only resolves under
 * Next.js's bundler — not under this script's plain tsx/Node execution.
 */
async function seedDemoCatalog(tenantId: string, performedById: string) {
  console.log("Seeding demo categories and products...");

  const categoryDefs = [
    { slug: "rolamentos", name: "Rolamentos" },
    { slug: "correias-transmissao", name: "Correias e Transmissão" },
    { slug: "vedacao-retentores", name: "Vedação e Retentores" },
  ];

  const categories: Record<string, string> = {};
  for (const def of categoryDefs) {
    const category = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug: def.slug } },
      update: { name: def.name },
      create: { tenantId, slug: def.slug, name: def.name },
    });
    categories[def.slug] = category.id;
  }

  interface DemoProduct {
    sku: string;
    name: string;
    categorySlug: string;
    manufacturer: string;
    model: string;
    specifications: { key: string; value: string }[];
    minCommercialQuantity: number;
    inventory: {
      quantityOnHand: number;
      quantityReserved: number;
      quantityBlocked: number;
      quantityAvailableToSell: number;
      reorderPoint: number;
      maxStock: number;
      safetyStock: number;
    };
  }

  const demoProducts: DemoProduct[] = [
    {
      sku: "RLM-6205-2RS",
      name: "Rolamento rígido de esferas 6205-2RS",
      categorySlug: "rolamentos",
      manufacturer: "NSK",
      model: "6205-2RS",
      specifications: [
        { key: "Diâmetro interno", value: "25 mm" },
        { key: "Diâmetro externo", value: "52 mm" },
        { key: "Largura", value: "15 mm" },
        { key: "Vedação", value: "2RS (dupla borracha)" },
      ],
      minCommercialQuantity: 50,
      inventory: {
        quantityOnHand: 420,
        quantityReserved: 20,
        quantityBlocked: 0,
        quantityAvailableToSell: 350,
        reorderPoint: 100,
        maxStock: 600,
        safetyStock: 50,
      },
    },
    {
      sku: "RLM-6304-2RS",
      name: "Rolamento rígido de esferas 6304-2RS",
      categorySlug: "rolamentos",
      manufacturer: "NSK",
      model: "6304-2RS",
      specifications: [
        { key: "Diâmetro interno", value: "20 mm" },
        { key: "Diâmetro externo", value: "52 mm" },
        { key: "Largura", value: "21 mm" },
      ],
      minCommercialQuantity: 50,
      inventory: {
        quantityOnHand: 60,
        quantityReserved: 10,
        quantityBlocked: 0,
        quantityAvailableToSell: 40,
        reorderPoint: 80,
        maxStock: 300,
        safetyStock: 30,
      },
    },
    {
      sku: "ROL-CONICO-30206",
      name: "Rolamento cônico 30206",
      categorySlug: "rolamentos",
      manufacturer: "Timken",
      model: "30206",
      specifications: [
        { key: "Diâmetro interno", value: "30 mm" },
        { key: "Diâmetro externo", value: "62 mm" },
        { key: "Tipo", value: "Rolos cônicos" },
      ],
      minCommercialQuantity: 10,
      inventory: {
        quantityOnHand: 12,
        quantityReserved: 0,
        quantityBlocked: 0,
        quantityAvailableToSell: 12,
        reorderPoint: 15,
        maxStock: 100,
        safetyStock: 10,
      },
    },
    {
      sku: "ROL-ESF-6006",
      name: "Rolamento rígido de esferas 6006",
      categorySlug: "rolamentos",
      manufacturer: "NSK",
      model: "6006",
      specifications: [
        { key: "Diâmetro interno", value: "30 mm" },
        { key: "Diâmetro externo", value: "55 mm" },
        { key: "Largura", value: "13 mm" },
      ],
      minCommercialQuantity: 100,
      inventory: {
        quantityOnHand: 500,
        quantityReserved: 0,
        quantityBlocked: 0,
        quantityAvailableToSell: 450,
        reorderPoint: 150,
        maxStock: 900,
        safetyStock: 80,
      },
    },
    {
      sku: "COR-A-1200",
      name: "Correia em V perfil A, 1200mm",
      categorySlug: "correias-transmissao",
      manufacturer: "Gates",
      model: "A-1200",
      specifications: [
        { key: "Perfil", value: "A" },
        { key: "Comprimento", value: "1200 mm" },
      ],
      minCommercialQuantity: 20,
      inventory: {
        quantityOnHand: 150,
        quantityReserved: 0,
        quantityBlocked: 0,
        quantityAvailableToSell: 150,
        reorderPoint: 30,
        maxStock: 400,
        safetyStock: 20,
      },
    },
    {
      sku: "COR-B-1500",
      name: "Correia em V perfil B, 1500mm",
      categorySlug: "correias-transmissao",
      manufacturer: "Gates",
      model: "B-1500",
      specifications: [
        { key: "Perfil", value: "B" },
        { key: "Comprimento", value: "1500 mm" },
      ],
      minCommercialQuantity: 20,
      inventory: {
        quantityOnHand: 90,
        quantityReserved: 0,
        quantityBlocked: 0,
        quantityAvailableToSell: 90,
        reorderPoint: 20,
        maxStock: 250,
        safetyStock: 15,
      },
    },
    {
      sku: "RET-25X40X7",
      name: "Retentor 25x40x7mm",
      categorySlug: "vedacao-retentores",
      manufacturer: "NAK",
      model: "25X40X7",
      specifications: [
        { key: "Diâmetro do eixo", value: "25 mm" },
        { key: "Diâmetro externo", value: "40 mm" },
        { key: "Espessura", value: "7 mm" },
      ],
      minCommercialQuantity: 100,
      inventory: {
        quantityOnHand: 800,
        quantityReserved: 50,
        quantityBlocked: 20,
        quantityAvailableToSell: 700,
        reorderPoint: 200,
        maxStock: 1500,
        safetyStock: 100,
      },
    },
    {
      sku: "RET-40X60X10",
      name: "Retentor 40x60x10mm",
      categorySlug: "vedacao-retentores",
      manufacturer: "NAK",
      model: "40X60X10",
      specifications: [
        { key: "Diâmetro do eixo", value: "40 mm" },
        { key: "Diâmetro externo", value: "60 mm" },
        { key: "Espessura", value: "10 mm" },
      ],
      minCommercialQuantity: 50,
      inventory: {
        quantityOnHand: 300,
        quantityReserved: 0,
        quantityBlocked: 10,
        quantityAvailableToSell: 280,
        reorderPoint: 100,
        maxStock: 800,
        safetyStock: 60,
      },
    },
  ];

  for (const def of demoProducts) {
    const existing = await prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: def.sku } },
    });
    if (existing) continue;

    const product = await prisma.product.create({
      data: {
        tenantId,
        sku: def.sku,
        name: def.name,
        categoryId: categories[def.categorySlug],
        manufacturer: def.manufacturer,
        model: def.model,
        unit: "UN",
        minCommercialQuantity: def.minCommercialQuantity,
        status: "ACTIVE",
        specifications: def.specifications,
        inventory: { create: def.inventory },
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: "ENTRADA",
        quantity: def.inventory.quantityOnHand,
        reason: "Carga inicial de estoque (dados de demonstração)",
        resultingQuantityOnHand: def.inventory.quantityOnHand,
        performedById,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
