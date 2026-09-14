"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { addProductImage, removeProductImage } from "../actions";

export interface ProductImageItem {
  id: string;
  url: string;
  altText: string | null;
}

export function ImagesPanel({ productId, images }: { productId: string; images: ProductImageItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addProductImage(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemove(imageId: string) {
    setError(null);
    setRemovingId(imageId);
    const formData = new FormData();
    formData.set("imageId", imageId);
    startTransition(async () => {
      const result = await removeProductImage(formData);
      setRemovingId(null);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {images.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nenhuma imagem cadastrada ainda.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-border-subtle bg-surface-muted">
              <Image
                src={image.url}
                alt={image.altText ?? ""}
                fill
                sizes="200px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => handleRemove(image.id)}
                disabled={isPending && removingId === image.id}
                className="absolute right-1 top-1 rounded-[var(--radius-sm)] bg-danger-600/90 px-1.5 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                {removingId === image.id ? "…" : "Remover"}
              </button>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} action={handleAdd} className="space-y-2 border-t border-border-subtle pt-4">
        <input type="hidden" name="productId" value={productId} />
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
          <div>
            <Label htmlFor="imageFile">Enviar arquivo (JPG/PNG/WEBP, até 5MB)</Label>
            <input
              id="imageFile"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-[13px]"
            />
          </div>
          <div>
            <Label htmlFor="imageUrl">Ou informar URL da imagem</Label>
            <Input id="imageUrl" name="url" type="url" placeholder="https://…" />
          </div>
        </div>
        <div>
          <Label htmlFor="altText">Descrição (opcional)</Label>
          <Input id="altText" name="altText" placeholder="Ex.: Rolamento 6205-2RS — vista frontal" />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && removingId === null ? "Enviando…" : "Adicionar imagem"}
        </Button>
      </form>
    </div>
  );
}
