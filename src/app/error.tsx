"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server-side errors are already captured by Next's own request log;
    // this client-side log just makes sure a client-only failure isn't
    // silently swallowed by the error boundary.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-950 px-4 text-center">
      <p className="font-tabular text-[13px] uppercase tracking-wide text-white/40">Erro inesperado</p>
      <h1 className="mt-2 text-[24px] font-semibold text-white">Algo deu errado</h1>
      <p className="mt-2 max-w-sm text-[14px] text-white/60">
        A operação não pôde ser concluída. Tente novamente — se o problema continuar, entre em
        contato com o suporte informando o horário em que ocorreu.
      </p>
      {error.digest ? (
        <p className="mt-2 font-tabular text-[12px] text-white/30">Referência: {error.digest}</p>
      ) : null}
      <Button variant="secondary" className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
