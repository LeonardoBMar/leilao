import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatShortDateTime } from "@/lib/format";

import { listUpcomingAuctions } from "../queries";

/** Cartão "Meu próximo leilão" no rodapé do menu (DESIGN.md §9). Sem leilão próximo, não aparece. Em <Suspense>. */
export async function NextAuctionCard() {
  const [next] = await listUpcomingAuctions(1);
  if (!next) return null;

  return (
    <Link
      href={`/minhas-analises/leiloes/${next.id}`}
      className="group grid grid-cols-1 gap-1 rounded-lg border border-border-strong/70 bg-foreground/3 px-3 py-2.5 transition-colors duration-150 ease-[var(--ease-out)] outline-none hover:border-border-strong hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-overline text-muted uppercase">Meu próximo leilão</span>
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-subtle transition-colors duration-150 ease-[var(--ease-out)] group-hover:text-foreground"
        />
      </span>
      <time dateTime={next.startsAt.toISOString()} className="text-body font-semibold text-foreground tabular-nums">
        {formatShortDateTime(next.startsAt)}
      </time>
      <span className="line-clamp-2 text-caption text-muted">
        {next.name} · {next.lotCount} {next.lotCount === 1 ? "lote" : "lotes"}
      </span>
    </Link>
  );
}
