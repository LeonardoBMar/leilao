import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import type { ResearchFilters } from "@/domain/research/filters";
import { MIN_SAMPLE, RATIO_BOUNDS, SMALL_SAMPLE } from "@/domain/research/summary";
import { formatDate, formatRatio } from "@/lib/format";

import { salesLabel } from "../labels";
import { getResearchOverview } from "../queries";
import { BidCurveSection } from "./bid-curve-block";
import { ResearchBlock } from "./research-block";

export const READING_BLOCK_TITLE = "Como lemos os dados";

/**
 * "Como lemos os dados" (docs/PLANO-MERCADO.md §6), recolhido no fim do Panorama: a curva do lance, de onde vem a FIPE
 * de cada venda e as regras de amostra. Tira do cabeçalho e dos blocos o que é explicação de método.
 */
export async function ReadingBlock({ filters }: { filters: ResearchFilters }) {
  const { sales, fipeMatched, since } = await getResearchOverview();
  const coverage =
    sales === 0
      ? ""
      : ` Das ${salesLabel(sales)} desde ${since === null ? "o início" : formatDate(since)}, ${formatRatio(fipeMatched / sales)} têm a FIPE casada pelo sistema (pela versão ou pela família do modelo); nas outras, vale o valor que a fonte informou.`;

  return (
    <ResearchBlock
      id="pesquisa-leitura"
      title={READING_BLOCK_TITLE}
      description="A curva do lance, de onde vem a FIPE e as regras de amostra."
    >
      <details>
        <summary className="w-fit cursor-pointer text-label text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Mostrar
        </summary>
        <div className="mt-4 grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <BidCurveSection filters={filters} />
          </Suspense>
          <div className="grid content-start gap-6">
            <section aria-labelledby="pesquisa-leitura-fipe" className="grid gap-2">
              <h3 id="pesquisa-leitura-fipe" className="text-heading-3 text-foreground">
                De onde vem a FIPE
              </h3>
              <p className="text-body text-muted">
                O % da FIPE é o lance final dividido pelo valor de mercado da venda.{coverage} Vendas sem valor de
                mercado, ou com o lance abaixo de {formatRatio(RATIO_BOUNDS.min)} ou acima de{" "}
                {formatRatio(RATIO_BOUNDS.max)} dele, ficam fora dos gráficos em %.
              </p>
            </section>
            <section aria-labelledby="pesquisa-leitura-regras" className="grid gap-2">
              <h3 id="pesquisa-leitura-regras" className="text-heading-3 text-foreground">
                Regras de amostra
              </h3>
              <ul className="grid list-disc gap-1 pl-5 text-body text-muted">
                <li>Com menos de {MIN_SAMPLE} vendas, um grupo não tem mediana: as vendas aparecem uma a uma.</li>
                <li>
                  De {MIN_SAMPLE} a {SMALL_SAMPLE - 1} vendas, a mediana aparece marcada como amostra pequena.
                </li>
                <li>A condição nunca se mistura: cada número é de uma condição só.</li>
                <li>&ldquo;Sem monta declarada&rdquo; quer dizer que a fonte não informou a condição.</li>
                <li>O estado é o do pátio; a distância é em linha reta até a cidade dele.</li>
              </ul>
            </section>
          </div>
        </div>
      </details>
    </ResearchBlock>
  );
}
