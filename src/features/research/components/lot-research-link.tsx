import { ChartNoAxesColumn } from "lucide-react";

import { ButtonLink } from "@/components/ui";

import { lotResearchFilters } from "../lot-link";
import { getLotResearchContext } from "../queries";
import { researchHref } from "../search";

/**
 * "Ver vendas parecidas" (D-45): abre a Pesquisa já com o modelo do lote e, se o lote vem de um anúncio coletado, a
 * condição, a categoria e o estado dele. Some se o lote não é do usuário.
 */
export async function LotResearchLink({ lotId, variant = "link" }: { lotId: string; variant?: "link" | "secondary" }) {
  const context = await getLotResearchContext(lotId);
  if (context === null) return null;
  return (
    <ButtonLink href={researchHref(lotResearchFilters(context))} variant={variant} size="sm" className="w-fit">
      <ChartNoAxesColumn aria-hidden="true" />
      Ver vendas parecidas
    </ButtonLink>
  );
}
