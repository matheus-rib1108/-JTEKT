import { EmptyState } from "@/components/ui/empty-state";

export function PlaceholderPage({
  title,
  phaseLabel,
  description,
  bullets,
}: {
  title: string;
  phaseLabel: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>
      <EmptyState
        title="Módulo ainda não implementado"
        phaseLabel={phaseLabel}
        description={description}
        action={
          bullets ? (
            <ul className="mt-1 space-y-1 text-[13px] text-text-muted">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span className="text-brand-500">—</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : undefined
        }
      />
    </div>
  );
}
