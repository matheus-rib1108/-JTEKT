import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Redefinir senha — StockFlow B2B" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueci minha senha"
      subtitle="Informe o e-mail da sua conta. Se estiver cadastrado, enviaremos um link de redefinição."
      footer={
        <p className="text-[13px] text-text-muted">
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Voltar para o login
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
