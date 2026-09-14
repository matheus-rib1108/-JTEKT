"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { addProductDocument, removeProductDocument } from "../actions";

export interface ProductDocumentItem {
  id: string;
  label: string;
  url: string;
}

export function DocumentsPanel({ productId, documents }: { productId: string; documents: ProductDocumentItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addProductDocument(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemove(documentId: string) {
    setError(null);
    setRemovingId(documentId);
    const formData = new FormData();
    formData.set("documentId", documentId);
    startTransition(async () => {
      const result = await removeProductDocument(formData);
      setRemovingId(null);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {documents.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nenhum documento técnico cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between py-2 text-[13px]">
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                {doc.label}
              </a>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending && removingId === doc.id}
                onClick={() => handleRemove(doc.id)}
              >
                {removingId === doc.id ? "…" : "Remover"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={handleAdd} className="space-y-2 border-t border-border-subtle pt-4">
        <input type="hidden" name="productId" value={productId} />
        <div>
          <Label htmlFor="docLabel">Nome do documento</Label>
          <Input id="docLabel" name="label" required placeholder="Ex.: Ficha técnica, Desenho técnico" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="docFile">Enviar arquivo (PDF, até 15MB)</Label>
            <input id="docFile" name="file" type="file" accept="application/pdf" className="block w-full text-[13px]" />
          </div>
          <div>
            <Label htmlFor="docUrl">Ou informar URL do documento</Label>
            <Input id="docUrl" name="url" type="url" placeholder="https://…" />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && removingId === null ? "Enviando…" : "Adicionar documento"}
        </Button>
      </form>
    </div>
  );
}
