import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — StockFlow B2B" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Acessar plataforma"
      subtitle="Entre com as credenciais da sua conta corporativa."
      footer={
        <p className="text-[13px] text-text-muted">
          Empresa cliente sem conta?{" "}
          <Link href="/register" className="font-medium text-brand-700 hover:underline">
            Solicitar cadastro B2B
          </Link>
        </p>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="mt-3 text-right">
        <Link href="/forgot-password" className="text-[13px] text-brand-700 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
    </AuthShell>
  );
}
