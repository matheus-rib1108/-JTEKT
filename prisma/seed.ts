import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS, type RoleKey } from "../src/lib/permissions";
import { NON_STANDARD_BASELINE_KEY } from "../src/lib/warehouse-constants";

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "jtekt";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@jtekt.demo";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "TrocarSenha#2026";
const SEED_COMERCIAL_EMAIL = process.env.SEED_COMERCIAL_EMAIL ?? "comercial@jtekt.demo";
const SEED_COMERCIAL_PASSWORD = process.env.SEED_COMERCIAL_PASSWORD ?? "TrocarSenha#2026b";

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

  // Second internal admin — needed for real two-person governance flows
  // (§12/§26: reviewing and approving a client company registration always
  // requires two *different* administrators; a single seeded admin can't
  // demonstrate that on its own).
  const comercialRole = await prisma.role.findUniqueOrThrow({ where: { key: "COMERCIAL" } });
  const comercialUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: SEED_COMERCIAL_EMAIL },
  });
  if (!comercialUser) {
    console.log(`Creating demo Comercial admin: ${SEED_COMERCIAL_EMAIL}`);
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        userType: "INTERNAL",
        name: "Comercial StockFlow",
        email: SEED_COMERCIAL_EMAIL,
        passwordHash: await bcrypt.hash(SEED_COMERCIAL_PASSWORD, 12),
        roleId: comercialRole.id,
        status: "ACTIVE",
      },
    });
    console.log(`Demo credentials -> ${SEED_COMERCIAL_EMAIL} / ${SEED_COMERCIAL_PASSWORD}`);
  } else {
    console.log("Demo Comercial admin already exists, skipping.");
  }

  await seedDemoCatalog(tenant.id, adminUser.id);
  await seedDemoWarehouse(tenant.id, adminUser.id);
  await seedDemoPricing(tenant.id, adminUser.id);

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
    application: string;
    specifications: { key: string; value: string }[];
    minCommercialQuantity: number;
    unitCost: number;
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
      application: "Automotiva/Industrial",
      specifications: [
        { key: "Diâmetro interno", value: "25 mm" },
        { key: "Diâmetro externo", value: "52 mm" },
        { key: "Largura", value: "15 mm" },
        { key: "Vedação", value: "2RS (dupla borracha)" },
      ],
      minCommercialQuantity: 50,
      unitCost: 18.5,
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
      application: "Automotiva/Industrial",
      specifications: [
        { key: "Diâmetro interno", value: "20 mm" },
        { key: "Diâmetro externo", value: "52 mm" },
        { key: "Largura", value: "21 mm" },
      ],
      minCommercialQuantity: 50,
      unitCost: 22.9,
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
      application: "Máquinas pesadas/Industrial",
      specifications: [
        { key: "Diâmetro interno", value: "30 mm" },
        { key: "Diâmetro externo", value: "62 mm" },
        { key: "Tipo", value: "Rolos cônicos" },
      ],
      minCommercialQuantity: 10,
      unitCost: 45.0,
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
      application: "Automotiva/Industrial",
      specifications: [
        { key: "Diâmetro interno", value: "30 mm" },
        { key: "Diâmetro externo", value: "55 mm" },
        { key: "Largura", value: "13 mm" },
      ],
      minCommercialQuantity: 100,
      unitCost: 14.2,
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
      application: "Transmissão de potência industrial",
      specifications: [
        { key: "Perfil", value: "A" },
        { key: "Comprimento", value: "1200 mm" },
      ],
      minCommercialQuantity: 20,
      unitCost: 32.0,
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
      application: "Transmissão de potência industrial",
      specifications: [
        { key: "Perfil", value: "B" },
        { key: "Comprimento", value: "1500 mm" },
      ],
      minCommercialQuantity: 20,
      unitCost: 41.5,
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
      application: "Vedação de eixos rotativos",
      specifications: [
        { key: "Diâmetro do eixo", value: "25 mm" },
        { key: "Diâmetro externo", value: "40 mm" },
        { key: "Espessura", value: "7 mm" },
      ],
      minCommercialQuantity: 100,
      unitCost: 6.8,
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
      application: "Vedação de eixos rotativos",
      specifications: [
        { key: "Diâmetro do eixo", value: "40 mm" },
        { key: "Diâmetro externo", value: "60 mm" },
        { key: "Espessura", value: "10 mm" },
      ],
      minCommercialQuantity: 50,
      unitCost: 9.9,
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
        application: def.application,
        unit: "UN",
        minCommercialQuantity: def.minCommercialQuantity,
        unitCost: def.unitCost,
        status: "ACTIVE",
        specifications: def.specifications,
        // lastMovementAt mirrors the ENTRADA created just below — this
        // bypasses src/server/inventory/engine.ts (see module comment
        // above), so it must be set by hand or the row would read as "no
        // movement ever recorded" despite the initial stock load existing.
        inventory: { create: { ...def.inventory, lastMovementAt: new Date() } },
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

/**
 * Demo warehouse addressing (§15/§17). Inserted directly via Prisma for the
 * same reason as seedDemoCatalog: src/server/warehouse/engine.ts imports
 * "server-only", which only resolves under Next.js's bundler.
 */
async function seedDemoWarehouse(tenantId: string, performedById: string) {
  console.log("Seeding demo warehouse and positions...");

  const existingWarehouse = await prisma.warehouse.findUnique({
    where: { tenantId_code: { tenantId, code: "A" } },
  });
  if (existingWarehouse) {
    console.log("Demo warehouse already exists, skipping.");
    return;
  }

  const warehouse = await prisma.warehouse.create({
    data: { tenantId, code: "A", name: "Galpão A" },
  });

  interface RackDef {
    corridor: string;
    rack: string;
    area: string;
    levelCount: number;
    positionsPerLevel: number;
  }

  const racks: RackDef[] = [
    { corridor: "03", rack: "R12", area: "Rolamentos e correias", levelCount: 4, positionsPerLevel: 8 },
    { corridor: "05", rack: "R20", area: "Vedação e retentores", levelCount: 2, positionsPerLevel: 6 },
  ];

  const locationByCode = new Map<string, string>(); // code -> id

  for (const rackDef of racks) {
    for (let levelIndex = 1; levelIndex <= rackDef.levelCount; levelIndex += 1) {
      const level = `N${String(levelIndex).padStart(2, "0")}`;
      for (let positionIndex = 1; positionIndex <= rackDef.positionsPerLevel; positionIndex += 1) {
        const position = `P${String(positionIndex).padStart(2, "0")}`;
        const code = `${warehouse.code}-${rackDef.corridor}-${rackDef.rack}-${level}-${position}`;

        const location = await prisma.storageLocation.create({
          data: {
            tenantId,
            warehouseId: warehouse.id,
            area: rackDef.area,
            corridor: rackDef.corridor,
            rack: rackDef.rack,
            level,
            position,
            code,
          },
        });
        locationByCode.set(code, location.id);
      }
    }
  }

  console.log(`Created ${locationByCode.size} demo positions.`);

  // Allocate part of the already-seeded demo catalog's stock to specific
  // positions — deliberately partial, since not everything has been mapped
  // to a formal address yet (that incompleteness is the point of §17).
  const allocations: { sku: string; code: string; quantity: number }[] = [
    { sku: "RLM-6205-2RS", code: "A-03-R12-N01-P01", quantity: 300 },
    { sku: "RLM-6205-2RS", code: "A-03-R12-N01-P02", quantity: 50 },
    { sku: "RLM-6304-2RS", code: "A-03-R12-N02-P01", quantity: 40 },
    { sku: "ROL-CONICO-30206", code: "A-03-R12-N02-P02", quantity: 12 },
    { sku: "ROL-ESF-6006", code: "A-03-R12-N03-P01", quantity: 400 },
    { sku: "COR-A-1200", code: "A-03-R12-N04-P01", quantity: 150 },
    { sku: "COR-B-1500", code: "A-03-R12-N04-P02", quantity: 90 },
    { sku: "RET-25X40X7", code: "A-05-R20-N01-P01", quantity: 700 },
    { sku: "RET-40X60X10", code: "A-05-R20-N01-P02", quantity: 280 },
  ];

  const occupiedLocationIds = new Set<string>();

  for (const allocation of allocations) {
    const product = await prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: allocation.sku } },
    });
    const storageLocationId = locationByCode.get(allocation.code);
    if (!product || !storageLocationId) continue;

    await prisma.productStorageLocation.create({
      data: { productId: product.id, storageLocationId, quantity: allocation.quantity },
    });
    occupiedLocationIds.add(storageLocationId);
  }

  await prisma.storageLocation.updateMany({
    where: { id: { in: Array.from(occupiedLocationIds) } },
    data: { status: "OCCUPIED" },
  });

  // A handful of positions flagged as not following the formal addressing
  // scheme yet — independent of whether they hold stock (§17's "580
  // positions" problem, at demo scale).
  const nonStandardCodes = [
    "A-03-R12-N01-P03",
    "A-03-R12-N01-P04",
    "A-03-R12-N02-P03",
    "A-03-R12-N02-P04",
    "A-05-R20-N02-P01",
    "A-05-R20-N02-P02",
  ];
  const nonStandardIds = nonStandardCodes
    .map((code) => locationByCode.get(code))
    .filter((id): id is string => Boolean(id));

  await prisma.storageLocation.updateMany({
    where: { id: { in: nonStandardIds } },
    data: {
      isNonStandard: true,
      nonStandardNote: "Identificada na auditoria inicial de endereçamento (dados de demonstração).",
    },
  });

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId, key: NON_STANDARD_BASELINE_KEY } },
    update: {},
    create: {
      tenantId,
      key: NON_STANDARD_BASELINE_KEY,
      value: { count: nonStandardIds.length, setAt: new Date().toISOString() },
      updatedById: performedById,
    },
  });

  console.log(`Marked ${nonStandardIds.length} positions as non-standard and set baseline.`);
}

/**
 * Demo pricing (§9 pricing engine) and one demo offer (§10). Inserted
 * directly via Prisma for the same reason as the functions above:
 * src/server/pricing/engine.ts and src/server/offers/engine.ts import
 * "server-only". List/min prices below are plausible relative to each
 * product's already-seeded unitCost (§3), never invented independently
 * of it.
 */
async function seedDemoPricing(tenantId: string, performedById: string) {
  console.log("Seeding demo pricing...");

  interface PricingDef {
    sku: string;
    listPrice: number;
    minPrice: number;
    tiers: { minQuantity: number; discountPercent: number }[];
  }

  const pricingDefs: PricingDef[] = [
    {
      sku: "RLM-6205-2RS",
      listPrice: 34.9,
      minPrice: 24.0,
      tiers: [
        { minQuantity: 100, discountPercent: 5 },
        { minQuantity: 300, discountPercent: 10 },
      ],
    },
    {
      sku: "RLM-6304-2RS",
      listPrice: 42.9,
      minPrice: 29.0,
      tiers: [
        { minQuantity: 50, discountPercent: 5 },
        { minQuantity: 150, discountPercent: 10 },
      ],
    },
    {
      sku: "ROL-CONICO-30206",
      listPrice: 79.9,
      minPrice: 55.0,
      tiers: [{ minQuantity: 5, discountPercent: 5 }],
    },
    {
      sku: "ROL-ESF-6006",
      listPrice: 26.9,
      minPrice: 18.0,
      tiers: [
        { minQuantity: 200, discountPercent: 8 },
        { minQuantity: 500, discountPercent: 15 },
      ],
    },
    {
      sku: "COR-A-1200",
      listPrice: 58.9,
      minPrice: 40.0,
      tiers: [{ minQuantity: 50, discountPercent: 6 }],
    },
    {
      sku: "COR-B-1500",
      listPrice: 74.9,
      minPrice: 52.0,
      tiers: [{ minQuantity: 40, discountPercent: 6 }],
    },
    {
      sku: "RET-25X40X7",
      listPrice: 12.9,
      minPrice: 8.5,
      tiers: [
        { minQuantity: 300, discountPercent: 10 },
        { minQuantity: 600, discountPercent: 18 },
      ],
    },
    {
      sku: "RET-40X60X10",
      listPrice: 18.9,
      minPrice: 12.5,
      tiers: [
        { minQuantity: 100, discountPercent: 8 },
        { minQuantity: 250, discountPercent: 15 },
      ],
    },
  ];

  for (const def of pricingDefs) {
    const product = await prisma.product.findUnique({ where: { tenantId_sku: { tenantId, sku: def.sku } } });
    if (!product) continue;

    const existing = await prisma.productPricing.findUnique({ where: { productId: product.id } });
    if (existing) continue;

    const pricing = await prisma.productPricing.create({
      data: {
        productId: product.id,
        listPrice: def.listPrice,
        minPrice: def.minPrice,
        updatedById: performedById,
      },
    });

    await prisma.priceTier.createMany({
      data: def.tiers.map((tier) => ({
        productPricingId: pricing.id,
        minQuantity: tier.minQuantity,
        discountPercent: tier.discountPercent,
      })),
    });
  }

  // One demo offer, already approved and active, on the SKU with the
  // largest on-hand quantity (RET-25X40X7, 800 un.) — a plausible surplus
  // candidate rather than an arbitrary pick. Progress starts at 0% because
  // no sale has actually drawn down the stock yet (there is no Order
  // model until Phase 7) — never faked as partial progress.
  const offerProduct = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId, sku: "RET-25X40X7" } },
    include: { inventory: true },
  });
  if (offerProduct) {
    const existingOffer = await prisma.offer.findFirst({ where: { productId: offerProduct.id } });
    if (!existingOffer) {
      const startedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      await prisma.offer.create({
        data: {
          tenantId,
          productId: offerProduct.id,
          discountPercent: 15,
          targetReduceQuantity: 200,
          internalReason: "Excedente de estoque identificado pelo Smart Stock Engine (§10, dados de demonstração).",
          initialQuantityOnHand: offerProduct.inventory?.quantityOnHand ?? 0,
          status: "ACTIVE",
          startedAt,
          createdById: performedById,
          approvedById: performedById,
          approvedAt: startedAt,
        },
      });
      console.log("Created demo offer on RET-25X40X7.");
    }
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
