"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

interface FormState {
  companyLegalName: string;
  companyTradeName: string;
  cnpj: string;
  phone: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

const INITIAL_STATE: FormState = {
  companyLegalName: "",
  companyTradeName: "",
  cnpj: "",
  phone: "",
  adminName: "",
  adminEmail: "",
  password: "",
};

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível concluir o cadastro.");
        if (data.details?.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const [key, messages] of Object.entries(data.details.fieldErrors)) {
            if (Array.isArray(messages) && messages[0]) flat[key] = messages[0];
          }
          setFieldErrors(flat);
        }
        return;
      }

      router.push("/portal");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <fieldset className="space-y-3">
        <legend className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          Dados da empresa
        </legend>
        <div>
          <Label htmlFor="companyLegalName">Razão social</Label>
          <Input
            id="companyLegalName"
            required
            value={form.companyLegalName}
            onChange={(e) => update("companyLegalName", e.target.value)}
          />
          <FieldError message={fieldErrors.companyLegalName} />
        </div>
        <div>
          <Label htmlFor="companyTradeName">Nome fantasia (opcional)</Label>
          <Input
            id="companyTradeName"
            value={form.companyTradeName}
            onChange={(e) => update("companyTradeName", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              required
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={(e) => update("cnpj", e.target.value)}
            />
            <FieldError message={fieldErrors.cnpj} />
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          Administrador da conta
        </legend>
        <div>
          <Label htmlFor="adminName">Nome completo</Label>
          <Input
            id="adminName"
            required
            value={form.adminName}
            onChange={(e) => update("adminName", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="adminEmail">E-mail corporativo</Label>
          <Input
            id="adminEmail"
            type="email"
            required
            value={form.adminEmail}
            onChange={(e) => update("adminEmail", e.target.value)}
          />
          <FieldError message={fieldErrors.adminEmail} />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            required
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <p className="mt-1 text-[12px] text-text-faint">Mínimo 10 caracteres, com letras e números.</p>
          <FieldError message={fieldErrors.password} />
        </div>
      </fieldset>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando…" : "Solicitar cadastro"}
      </Button>
    </form>
  );
}
