import type { AnalysisField } from "@/domain/finance/calculator";
import type { LimitPosition } from "@/domain/research/evaluate";

/** Nomes dos campos em pt-BR, usados na lista de pendências para fixar (SPEC §7.6). */
export const FIELD_LABELS = {
  marketValue: "Valor de venda esperado",
  repairCost: "Reparos",
  documentationCost: "Documentação",
  transportCost: "Transporte/guincho",
  tiresCost: "Pneus",
  serviceCost: "Revisão",
  otherFees: "Outras taxas",
  debtsCost: "Débitos (IPVA/multas)",
  sellingCost: "Custos de comercialização",
  taxCost: "Impostos na revenda",
  commissionMode: "Modalidade da comissão",
  commissionFixed: "Comissão fixa",
  commissionRateBps: "Taxa de comissão",
  riskReserve: "Reserva para imprevistos",
  desiredMargin: "Margem desejada",
} satisfies Record<AnalysisField, string>;

/** Nome do campo no formulário para cada entrada do domínio (a taxa é digitada em %). */
export const FORM_FIELD = {
  marketValue: "marketValue",
  repairCost: "repairCost",
  documentationCost: "documentationCost",
  transportCost: "transportCost",
  tiresCost: "tiresCost",
  serviceCost: "serviceCost",
  otherFees: "otherFees",
  debtsCost: "debtsCost",
  sellingCost: "sellingCost",
  taxCost: "taxCost",
  commissionMode: "commissionMode",
  commissionFixed: "commissionFixed",
  commissionRateBps: "commissionRate",
  riskReserve: "riskReserveRate",
  desiredMargin: "desiredMarginRate",
} satisfies Record<AnalysisField, string>;

export const FIXED_COST_LABELS = [
  ["repairCost", "Reparos"],
  ["documentationCost", "Documentação"],
  ["transportCost", "Transporte/guincho"],
  ["tiresCost", "Pneus"],
  ["serviceCost", "Revisão"],
  ["otherFees", "Outras taxas fixas"],
  ["debtsCost", "Débitos anteriores (IPVA/multas)"],
  ["sellingCost", "Comercialização (anúncio/venda)"],
  ["taxCost", "Impostos na revenda"],
] as const;

/**
 * Onde um valor fica entre as vendas parecidas, em palavras (bloco Concorrência, docs/PLANO-MERCADO.md §8): "fica abaixo
 * de 14 das 18 vendas parecidas (P22)". Descritivo: quem saiu acima é quem o limite não alcançaria.
 */
export function limitPositionText({ n, below, above, equal, percentile }: LimitPosition): string {
  const all = n === 1 ? "da única venda parecida" : `de todas as ${n} vendas parecidas`;
  const text =
    equal === n
      ? `empata com ${n === 1 ? "a única venda parecida" : `todas as ${n} vendas parecidas`}`
      : above === n
        ? `fica abaixo ${all}`
        : below === n
          ? `fica acima ${all}`
          : `fica abaixo de ${above} das ${n} vendas parecidas${equal > 0 ? ` e empata com ${equal}` : ""}`;
  return `${text} (P${percentile})`;
}
