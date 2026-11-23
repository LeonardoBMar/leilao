import type { EvaluateFilters } from "@/domain/research/evaluate";
import { formatCompactBRL } from "@/lib/format";

import { salesLabel } from "../labels";
import type { EvaluationView } from "../types";
import {
  EvaluateComparablesList,
  type SerializableAnswer,
  type SerializableComparable,
} from "./evaluate-comparables-list";
import { ResearchBlock } from "./research-block";

/**
 * Vendas do recorte (docs/PLANO-MERCADO.md §5.2), da mais parecida com o lote alvo (ou da mais recente) para baixo,
 * cada uma com o motivo da semelhança. "Tirar da conta" grava a venda em `fora` na URL e o servidor refaz a faixa; a
 * venda continua na lista, marcada, para poder voltar. O link fica compartilhável.
 */
export function EvaluateComparables({ filters, evaluation }: { filters: EvaluateFilters; evaluation: EvaluationView }) {
  const { answer, comparables, excluded } = evaluation;
  const bandPrefix =
    answer.kind === "band" ? `Faixa típica: ${formatCompactBRL(answer.low)} a ${formatCompactBRL(answer.high)}. ` : "";

  const items: SerializableComparable[] = comparables.map(({ sale, similarity }) => ({
    id: sale.id,
    url: sale.url,
    title: sale.title,
    endsAtMs: sale.endsAt.getTime(),
    modelYear: sale.modelYear,
    mileageKm: sale.mileageKm,
    origin: sale.origin,
    city: sale.city,
    state: sale.state,
    source: sale.source,
    photoUrl: sale.photoUrl,
    finalBidCents: sale.finalBid,
    marketValueCents: sale.marketValue,
    reasons: similarity?.reasons ?? [],
  }));

  const serializableAnswer: SerializableAnswer =
    answer.kind === "band"
      ? {
          kind: "band",
          lowCents: answer.low,
          medianCents: answer.median,
          highCents: answer.high,
          marketRatio: answer.marketRatio,
          n: answer.n,
          confidence: answer.confidence,
        }
      : { kind: "few", n: answer.n, needed: answer.needed };

  return (
    <ResearchBlock
      id="comparaveis"
      title={`Vendas do recorte (${comparables.length})`}
      description={
        excluded > 0
          ? `${bandPrefix}${salesLabel(excluded)} fora da conta nesta simulação (não altera análises salvas).`
          : `${bandPrefix}Tire da conta uma venda que não se parece com o veículo (outra versão, batida) para refazer a faixa nesta simulação.`
      }
    >
      <EvaluateComparablesList items={items} filters={filters} answer={serializableAnswer} />
    </ResearchBlock>
  );
}
