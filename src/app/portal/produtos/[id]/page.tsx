import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PortalProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, tenantId: user.tenantId, status: "ACTIVE" },
    include: {
      category: true,
      inventory: { select: { quantityAvailableToSell: true } },
      images: { orderBy: { position: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!product) notFound();

  const available = (product.inventory?.quantityAvailableToSell ?? 0) > 0;
  const specifications = Array.isArray(product.specifications)
    ? (product.specifications as { key: string; value: string }[])
    : [];

  return (
    <div className="space-y-5">
      <Link href="/portal/produtos" className="text-[13px] text-brand-700 hover:underline">
        ← Produtos
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface-muted">
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].altText ?? product.name}
                fill
                sizes="480px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-text-faint">
                Sem imagem cadastrada
              </div>
            )}
          </div>
          {product.images.length > 1 ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {product.images.slice(1).map((image) => (
                <div key={image.id} className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-border-subtle">
                  <Image src={image.url} alt={image.altText ?? ""} fill sizes="100px" className="object-cover" unoptimized />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="font-tabular text-[13px] text-text-muted">{product.sku}</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{product.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={available ? "success" : "neutral"}>
              {available ? "Disponível para compra" : "Indisponível"}
            </Badge>
            {product.category ? <Badge tone="brand">{product.category.name}</Badge> : null}
          </div>

          {product.description ? (
            <p className="mt-4 text-[13px] leading-relaxed text-text-muted">{product.description}</p>
          ) : null}

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4 text-[13px]">
            <DetailRow label="Fabricante" value={product.manufacturer ?? "—"} />
            <DetailRow label="Modelo" value={product.model ?? "—"} />
            <DetailRow label="Aplicação" value={product.application ?? "—"} />
            <DetailRow label="Unidade" value={product.unit} />
            <DetailRow label="Quantidade mínima de compra" value={`${product.minCommercialQuantity} ${product.unit}`} />
          </dl>

          {product.documents.length > 0 ? (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint">
                Documentos técnicos
              </p>
              <ul className="mt-2 space-y-1">
                {product.documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium text-brand-700 hover:underline"
                    >
                      Baixar {doc.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {specifications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Especificações técnicas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-border-subtle">
                {specifications.map((spec) => (
                  <tr key={spec.key}>
                    <td className="w-1/2 px-5 py-2 text-text-muted">{spec.key}</td>
                    <td className="px-5 py-2 font-medium text-foreground">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-text-faint">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
