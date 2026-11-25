import { compareToFixedLimit } from "@/domain/finance/calculator";

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

  const items: FollowedLotNavItem[] = rows.slice(0, SHOWN).map((item) => ({
    id: item.id,
    model: item.model,
    modelYear: item.modelYear,
    lotNumber: item.lotNumber,
    comparison: compareToFixedLimit(toFixedLimit(item.limit), item.currentBid),
  }));

  return <FollowedLotsNavList items={items} totalCount={rows.length} hasMore={rows.length > SHOWN} />;
}
