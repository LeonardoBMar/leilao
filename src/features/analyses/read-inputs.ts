import type { AnalysisInputs } from "@/domain/finance/calculator";
import { type Cents, parseBRL, parsePercent } from "@/domain/money";

/**
 * Leitura leniente do formulário para a prévia no navegador: campo vazio ou inválido vira `null`
 * (aparece como pendente), sem mensagens de erro. A validação que vale é a do servidor (`analysisFormSchema`).
 */
export function readAnalysisInputs(formData: FormData): AnalysisInputs {
  const money = (name: string): Cents | null => {
    const value = formData.get(name);
    if (typeof value !== "string" || value.trim() === "") return null;
    const parsed = parseBRL(value);
    return parsed !== null && parsed >= 0 ? parsed : null;
  };
  const mode = formData.get("commissionMode");
  const commissionMode = mode === "fixed" || mode === "percentage" ? mode : null;
  const rate = formData.get("commissionRate");

  return {
    marketValue: money("marketValue"),
    repairCost: money("repairCost"),
    documentationCost: money("documentationCost"),
    transportCost: money("transportCost"),
    tiresCost: money("tiresCost"),
    serviceCost: money("serviceCost"),
    otherFees: money("otherFees"),
    commissionMode,
    commissionFixed: commissionMode === "fixed" ? money("commissionFixed") : null,
    commissionRateBps:
      commissionMode === "percentage" && typeof rate === "string" && rate.trim() !== "" ? parsePercent(rate) : null,
    riskReserve: money("riskReserve"),
    desiredMargin: money("desiredMargin"),
  };
}
