import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-950 px-4 text-center">
      <p className="font-tabular text-[13px] uppercase tracking-wide text-white/40">Erro 404</p>
      <h1 className="mt-2 text-[24px] font-semibold text-white">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-[14px] text-white/60">
        O endereço não existe ou o item foi removido. Verifique o link ou volte ao início.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="secondary">Voltar ao início</Button>
      </Link>
    </div>
  );
}
