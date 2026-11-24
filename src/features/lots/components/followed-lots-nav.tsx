import { compareToFixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";

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

  const items: FollowedLotNavItem[] = rows.slice(0, SHOWN).map((row) => {
    const latest = row.analyses.find((analysis) => analysis.status === "fixed");
    const limit =
      latest?.isViable != null && latest.fixedAt
        ? {
            isViable: latest.isViable,
            maxBid: latest.maxBidCents === null ? null : cents(latest.maxBidCents),
            version: latest.version,
            fixedAt: latest.fixedAt,
          }
        : null;
    const currentBid = row.currentBidCents === null ? null : cents(row.currentBidCents);
    return {
      id: row.id,
      model: row.model,
      modelYear: row.modelYear,
      lotNumber: row.lotNumber,
      comparison: compareToFixedLimit(toFixedLimit(limit), currentBid),
    };
  });

  return <FollowedLotsNavList items={items} totalCount={rows.length} hasMore={rows.length > SHOWN} />;
}
