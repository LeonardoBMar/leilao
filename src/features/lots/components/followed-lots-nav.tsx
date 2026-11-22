import { Eye } from "lucide-react";
import Link from "next/link";

import { compareToFixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";

import { toFixedLimit } from "../limit";
import { getFollowedLotsBase } from "../queries";
import { type FollowedLotNavItem, FollowedLotsNavList } from "./followed-lots-nav-list";

const SHOWN = 5;

/**
 * Grupo "Acompanhando" do menu (DESIGN.md §9): lotes acompanhados ainda sem resultado, com a situação do lance num
 * ponto colorido (e em texto para leitores de tela). Sem nenhum, o grupo não aparece. Renderizar em <Suspense>.
 */
export async function FollowedLotsNav() {
  const rows = await getFollowedLotsBase();
  if (rows.length === 0) return null;

  const items: FollowedLotNavItem[] = rows.slice(0, SHOWN).map((row) => {
    const [latest] = row.analyses;
    const limit =
      latest?.isViable != null && latest.fixedAt
        ? {
            isViable: latest.isViable,
            maxBid: latest.maxBidCents === null ? null : cents(latest.maxBidCents),
            version: latest.version,
            fixedAt: latest.fixedAt,
          }
        : null;
    const currentBid = row.currentBidCents === null ? null : cents(row.currentBidCents);
    return {
      id: row.id,
      model: row.model,
      modelYear: row.modelYear,
      lotNumber: row.lotNumber,
      comparison: compareToFixedLimit(toFixedLimit(limit), currentBid),
    };
  });

  return (
    <nav aria-label="Lotes acompanhados" className="grid grid-cols-1 gap-1.5 border-t border-border pt-5">
      <p className="flex items-center gap-1.5 px-2.5 font-mono text-overline text-muted uppercase">
        <Eye aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
        Acompanhando
        <span className="ml-auto tabular-nums">{rows.length}</span>
      </p>
      <FollowedLotsNavList items={items} />
      {rows.length > SHOWN ? (
        <Link
          href="/minhas-analises?acompanhados=1&resultado=sem"
          className="inline-flex min-h-10 items-center rounded-sm px-2.5 text-caption text-muted outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent sm:min-h-8"
        >
          Ver todos
        </Link>
      ) : null}
    </nav>
  );
}
