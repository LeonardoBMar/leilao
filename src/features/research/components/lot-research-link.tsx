import { ChartNoAxesColumn } from "lucide-react";

import { ButtonLink } from "@/components/ui";
import { DEFAULT_EVALUATE_FILTERS } from "@/domain/research/evaluate";

import { getLotTarget } from "../queries";
import { evaluateHref } from "../search";

/**
 * "Ver vendas parecidas" (D-71): abre o Avaliar com o lote como alvo, no mesmo recorte do preço provável (modelo, ano
 * ±1 e condição). Some se o lote não é do usuário.
 */
export async function LotResearchLink({ lotId, variant = "link" }: { lotId: string; variant?: "link" | "secondary" }) {
  const lot = await getLotTarget(lotId);
  if (lot === null) return null;
  return (
    <ButtonLink
      href={evaluateHref({ ...DEFAULT_EVALUATE_FILTERS, lot: lot.id })}
      variant={variant}
      size="sm"
      className="w-fit"
    >
      <ChartNoAxesColumn aria-hidden="true" />
      Ver vendas parecidas
    </ButtonLink>
  );
}
