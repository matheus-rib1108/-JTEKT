import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border-subtle bg-brand-950">
      <div className="mx-auto max-w-6xl px-4 py-10 text-[13px] text-white/60">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold text-white">
              StockFlow<span className="text-accent-500">B2B</span>
            </p>
            <p className="mt-1 max-w-sm">
              Estoque, armazém e vendas B2B em um único sistema operacional.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterColumn title="Plataforma" items={["Estoque", "Armazém", "Ofertas B2B", "Cotações"]} />
            <FooterColumn title="Segurança" items={["RBAC", "Auditoria"]} />
            <FooterColumn
              title="Legal"
              items={[
                { label: "Termos de Uso", href: "/termos" },
                { label: "Política de Privacidade", href: "/privacidade" },
              ]}
            />
          </div>
        </div>
        <p className="mt-8 border-t border-white/10 pt-6 text-white/40">
          © {new Date().getFullYear()} StockFlow B2B. Esta instalação usa dados de demonstração.
        </p>
      </div>
    </footer>
  );
}

type FooterItem = string | { label: string; href: string };

function FooterColumn({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => {
          if (typeof item === "string") return <li key={item}>{item}</li>;
          return (
            <li key={item.href}>
              <Link href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
