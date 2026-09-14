import { EmptyState } from "@/components/ui/empty-state";

export function Forbidden() {
  return (
    <EmptyState
      title="Acesso não autorizado"
      description="Sua função não possui permissão para visualizar este módulo. Solicite acesso a um administrador, se necessário."
    />
  );
}
