import Link from "next/link";

import { compareToFixedLimit, type LimitComparison } from "@/domain/finance/calculator";
import { LIMIT_COMPARISON_LABELS } from "@/lib/limit-comparison";
import { cn } from "@/lib/utils";

import { toFixedLimit } from "../limit";
import { listLots } from "../queries";

const SHOWN = 5;

const DOT = {
  below_limit: "bg-success",
  at_limit: "bg-warning",
  above_limit: "bg-error",
  no_viable_bid: "bg-muted-subtle",
  unavailable: "bg-muted-subtle",
} as const satisfies Record<LimitComparison, string>;

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

  return (
    <section aria-labelledby="nav-followed" className="grid grid-cols-1 gap-1.5">
      <h2 id="nav-followed" className="px-2.5 text-caption font-medium text-muted">
        Acompanhando
      </h2>
      <ul className="grid grid-cols-1 gap-px">
        {page.items.slice(0, SHOWN).map((lot) => {
          const comparison = compareToFixedLimit(toFixedLimit(lot.limit), lot.currentBid);
          return (
            <li key={lot.id}>
              <Link
                href={`/lotes/${lot.id}`}
                className="flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-body font-medium text-foreground-secondary transition-colors duration-120 outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span aria-hidden="true" className="flex w-4 shrink-0 justify-center">
                  <span className={cn("size-1.75 rounded-full", DOT[comparison])} />
                </span>
                {/* `relative` prende o `sr-only` (absoluto) ao nome cortado: sem ele, o texto oculto fica no fim do nome
                    inteiro, fora do corte, e cria rolagem horizontal no menu. */}
                <span className="relative min-w-0 flex-1 truncate">
                  {lot.model} {lot.modelYear}
                  <span className="sr-only">: {LIMIT_COMPARISON_LABELS[comparison]}</span>
                </span>
                <span className="shrink-0 font-mono text-caption font-normal text-muted">{lot.lotNumber}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {page.total > SHOWN ? (
        <Link
          href="/minhas-analises?acompanhados=1&resultado=sem"
          className="px-2.5 text-caption text-muted hover:text-foreground hover:underline"
        >
          Ver os {page.total}
        </Link>
      ) : null}
    </section>
  );
}
