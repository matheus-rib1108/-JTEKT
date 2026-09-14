import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Cadastro B2B — StockFlow B2B" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Cadastro de empresa cliente"
      subtitle="Após o envio, sua empresa passa por validação comercial antes da liberação de compras."
      footer={
        <p className="text-[13px] text-text-muted">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
