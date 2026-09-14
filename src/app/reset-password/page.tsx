import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nova senha — StockFlow B2B" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Definir nova senha" subtitle="Escolha uma nova senha para sua conta.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
