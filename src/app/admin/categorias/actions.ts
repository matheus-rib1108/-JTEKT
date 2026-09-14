"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { requirePermission } from "@/server/auth/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { categorySchema } from "@/lib/validation/catalog";
import { slugify } from "@/lib/slugify";
import { writeAuditLog } from "@/server/audit/log";
import { getRequestIp } from "@/server/http/ip";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ipFromHeaders(): Promise<string | null> {
  return getRequestIp(new Request("http://localhost", { headers: await headers() }));
}

async function uniqueSlug(tenantId: string, base: string): Promise<string> {
  const baseSlug = slugify(base) || "categoria";
  let candidate = baseSlug;
  let attempt = 1;
  while (await prisma.category.findUnique({ where: { tenantId_slug: { tenantId, slug: candidate } } })) {
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }
  return candidate;
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const slug = await uniqueSlug(auth.user.tenantId, parsed.data.name);

  const category = await prisma.category.create({
    data: {
      tenantId: auth.user.tenantId,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      parentId: parsed.data.parentId || null,
    },
  });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "category.create",
    entityType: "Category",
    entityId: category.id,
    ipAddress: await ipFromHeaders(),
    afterData: { name: category.name, slug: category.slug },
  });

  revalidatePath("/admin/categorias");
  return { ok: true };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const auth = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE);
  if (!auth.user) return { ok: false, error: "Não autorizado." };

  const category = await prisma.category.findFirst({
    where: { id: categoryId, tenantId: auth.user.tenantId },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!category) return { ok: false, error: "Categoria não encontrada." };
  if (category._count.products > 0 || category._count.children > 0) {
    return { ok: false, error: "Categoria possui produtos ou subcategorias vinculadas." };
  }

  await prisma.category.delete({ where: { id: categoryId } });

  await writeAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "category.delete",
    entityType: "Category",
    entityId: categoryId,
    ipAddress: await ipFromHeaders(),
    beforeData: { name: category.name },
  });

  revalidatePath("/admin/categorias");
  return { ok: true };
}
