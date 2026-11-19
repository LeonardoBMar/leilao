import { Eye } from "lucide-react";
import Link from "next/link";

import { compareToFixedLimit } from "@/domain/finance/calculator";

import { toFixedLimit } from "../limit";
import { listLots } from "../queries";
import { type FollowedLotNavItem, FollowedLotsNavList } from "./followed-lots-nav-list";

const SHOWN = 5;

/**
 * Grupo "Acompanhando" do menu (DESIGN.md §9): lotes acompanhados ainda sem resultado, com a situação do lance num
 * ponto colorido (e em texto para leitores de tela). Sem nenhum, o grupo não aparece. Renderizar em <Suspense>.
 */
export async function FollowedLotsNav() {
  const page = await listLots({
    search: undefined,
    followedOnly: true,
    analysis: undefined,
    result: "sem",
    archived: false,
    position: undefined,
    timing: undefined,
    sort: "leilao",
    page: 1,
  });
  if (page.total === 0) return null;

  const items: FollowedLotNavItem[] = page.items.slice(0, SHOWN).map((lot) => ({
    id: lot.id,
    model: lot.model,
    modelYear: lot.modelYear,
    lotNumber: lot.lotNumber,
    comparison: compareToFixedLimit(toFixedLimit(lot.limit), lot.currentBid),
  }));

  return (
    <section aria-labelledby="nav-followed" className="grid grid-cols-1 gap-1.5 border-t border-border pt-5">
      <h2 id="nav-followed" className="flex items-center gap-1.5 px-2.5 font-mono text-overline text-muted uppercase">
        <Eye aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
        Acompanhando
        <span className="ml-auto tabular-nums">{page.total}</span>
      </h2>
      <FollowedLotsNavList items={items} />
      {page.total > SHOWN ? (
        <Link
          href="/minhas-analises?acompanhados=1&resultado=sem"
          className="px-2.5 text-caption text-muted hover:text-foreground hover:underline"
        >
          Ver todos
        </Link>
      ) : null}
    </section>
  );
}
