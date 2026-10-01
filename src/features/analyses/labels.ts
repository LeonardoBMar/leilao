import type { AnalysisField } from "@/domain/finance/calculator";

/** Nomes dos campos em pt-BR, usados na lista de pendências para fixar (SPEC §7.6). */
export const FIELD_LABELS = {
  marketValue: "Valor de venda esperado",
  repairCost: "Reparos",
  documentationCost: "Documentação",
  transportCost: "Transporte/guincho",
  tiresCost: "Pneus",
  serviceCost: "Revisão",
  otherFees: "Outras taxas",
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
] as const;
