import { Gavel } from "lucide-react";

/** Marca da casca (DESIGN.md §9): quadrado em tinta com o martelo e o nome do produto. */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-background">
        <Gavel aria-hidden="true" className="size-4" />
      </span>
      <span className="text-body leading-tight font-semibold text-foreground">Leilão Tracker</span>
    </div>
  );
}
