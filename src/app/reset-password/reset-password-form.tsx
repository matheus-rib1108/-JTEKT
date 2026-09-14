"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível redefinir a senha.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <Alert tone="danger">Link inválido. Solicite uma nova redefinição de senha.</Alert>;
  }

  if (done) {
    return <Alert tone="success">Senha redefinida. Redirecionando para o login…</Alert>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-[12px] text-text-faint">Mínimo 10 caracteres, com letras e números.</p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando…" : "Redefinir senha"}
      </Button>
    </form>
  );
}
