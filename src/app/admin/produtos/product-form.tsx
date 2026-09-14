"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { SpecificationEntry } from "@/lib/validation/catalog";

type ActionResult = { ok: true } | { ok: false; error: string };

export interface ProductFormValues {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  manufacturer: string;
  model: string;
  unit: string;
  minCommercialQuantity: number;
  status: "DRAFT" | "ACTIVE" | "DISCONTINUED";
  specifications: SpecificationEntry[];
}

const EMPTY_VALUES: ProductFormValues = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  manufacturer: "",
  model: "",
  unit: "UN",
  minCommercialQuantity: 1,
  status: "DRAFT",
  specifications: [],
};

export function ProductForm({
  action,
  categories,
  initialValues,
  submitLabel = "Salvar",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  categories: { id: string; name: string }[];
  initialValues?: Partial<ProductFormValues>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [specs, setSpecs] = useState<SpecificationEntry[]>(initialValues?.specifications ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateSpec(index: number, field: "key" | "value", value: string) {
    setSpecs((prev) => prev.map((spec, i) => (i === index ? { ...spec, [field]: value } : spec)));
  }

  function addSpec() {
    setSpecs((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeSpec(index: number) {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    const cleanSpecs = specs.filter((s) => s.key.trim() && s.value.trim());
    formData.set("specifications", JSON.stringify(cleanSpecs));
    startTransition(async () => {
      const result = await action(formData);
      if (result && !result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            name="sku"
            required
            value={values.sku}
            onChange={(e) => update("sku", e.target.value)}
            placeholder="Ex.: RLM-6205-2RS"
            className="font-tabular"
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as ProductFormValues["status"])}
            className="h-10 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
          >
            <option value="DRAFT">Rascunho (não visível no catálogo)</option>
            <option value="ACTIVE">Ativo</option>
            <option value="DISCONTINUED">Descontinuado</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required value={values.name} onChange={(e) => update("name", e.target.value)} />
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="categoryId">Categoria</Label>
          <select
            id="categoryId"
            name="categoryId"
            value={values.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
            className="h-10 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
          >
            <option value="">— Sem categoria —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="manufacturer">Fabricante</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            value={values.manufacturer}
            onChange={(e) => update("manufacturer", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" name="model" value={values.model} onChange={(e) => update("model", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="unit">Unidade</Label>
          <Input id="unit" name="unit" required value={values.unit} onChange={(e) => update("unit", e.target.value)} />
        </div>
      </div>

      <div className="w-48">
        <Label htmlFor="minCommercialQuantity">Quantidade mínima de venda</Label>
        <Input
          id="minCommercialQuantity"
          name="minCommercialQuantity"
          type="number"
          min={1}
          required
          value={values.minCommercialQuantity}
          onChange={(e) => update("minCommercialQuantity", Number(e.target.value))}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="mb-0">Especificações técnicas</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSpec}>
            Adicionar campo
          </Button>
        </div>
        {specs.length === 0 ? (
          <p className="text-[12px] text-text-faint">
            Ex.: diâmetro interno, diâmetro externo, largura, material — específico de cada peça.
          </p>
        ) : (
          <div className="space-y-2">
            {specs.map((spec, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  placeholder="Atributo (ex.: Diâmetro interno)"
                  value={spec.key}
                  onChange={(e) => updateSpec(index, "key", e.target.value)}
                />
                <Input
                  placeholder="Valor (ex.: 25 mm)"
                  value={spec.value}
                  onChange={(e) => updateSpec(index, "value", e.target.value)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSpec(index)}>
                  Remover
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
