import Link from "next/link";

import { formatShortDateTime } from "@/lib/format";

import { listUpcomingAuctions } from "../queries";

/** Cartão "Próximo leilão" no rodapé do menu (DESIGN.md §9). Sem leilão próximo, não aparece. Em <Suspense>. */
export async function NextAuctionCard() {
  const [next] = await listUpcomingAuctions(1);
  if (!next) return null;

  return (
    <Link
      href={`/leiloes/${next.id}`}
      className="grid grid-cols-1 gap-0.5 rounded-lg bg-foreground/3 px-3 py-3 transition-colors duration-120 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="text-caption text-muted">Próximo leilão</span>
      <span className="text-label font-semibold text-foreground tabular-nums">
        {formatShortDateTime(next.startsAt)}
      </span>
      <span className="truncate text-caption text-muted">
        {next.name} · {next.lotCount} {next.lotCount === 1 ? "lote" : "lotes"}
      </span>
    </Link>
  );
}
