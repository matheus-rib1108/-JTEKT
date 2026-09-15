"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function goToDestination(userType: string) {
    const next = searchParams.get("next");
    const destination = next ?? (userType === "CLIENT" ? "/portal" : "/admin/dashboard");
    router.push(destination);
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }

      if (data.mfaRequired) {
        setChallengeToken(data.challengeToken);
        return;
      }

      goToDestination(data.user.userType);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }

      goToDestination(data.user.userType);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (challengeToken) {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p className="text-[13px] text-text-muted">
          Informe o código de 6 dígitos do seu app autenticador.
        </p>
        <div>
          <Label htmlFor="mfaCode">Código de verificação</Label>
          <Input
            id="mfaCode"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verificando…" : "Confirmar"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setChallengeToken(null);
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-[12px] text-text-muted hover:text-foreground"
        >
          Voltar
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
