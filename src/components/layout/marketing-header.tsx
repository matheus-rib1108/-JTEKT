import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-[16px] font-semibold tracking-tight text-brand-900">
          StockFlow<span className="text-accent-600">B2B</span>
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] text-text-muted lg:flex">
          <a href="#plataforma" className="hover:text-foreground">Plataforma</a>
          <a href="#estoque" className="hover:text-foreground">Gestão de estoque</a>
          <a href="#seguranca" className="hover:text-foreground">Segurança</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary" size="sm">Cadastrar empresa</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
