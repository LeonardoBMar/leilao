/**
 * Leilão do catálogo (D-42): derivado dos anúncios coletados, agrupados por fonte e id do leilão na fonte.
 * Não existe tabela; os números vêm de uma consulta e a regra de data, situação e ordem fica aqui.
 */
export type CatalogAuctionStats = {
  sourceId: string;
  externalId: string;
  /** Nome do anúncio coletado mais recentemente (o leilão pode mudar de nome entre coletas). */
  name: string | null;
  /** Data do leilão informada pela fonte (o Pátio não informa). */
  auctionStartsAt: Date | null;
  /** Primeiro encerramento e primeiro início entre os lotes, para quando a fonte não informa a data. */
  firstStartsAt: Date | null;
  firstEndsAt: Date | null;
  /** Lotes do leilão no catálogo. */
  total: number;
  /** Lotes abertos de fato (situação aberta e fim no futuro ou desconhecido). */
  open: number;
  /** Lotes que atendem aos filtros da tela. */
  matching: number;
  /** Lotes que o usuário levou para análise. */
  analyzed: number;
};

/** Data exibida e usada na ordem (nula se nenhum lote tem data) e situação: aberto enquanto tiver lote aberto. */
export type CatalogAuctionState = { date: Date | null; isOpen: boolean };

/**
 * Data do leilão: a da fonte; sem ela, o primeiro encerramento dos lotes (no Pátio, o início é a abertura dos lances,
 * dias antes do leilão) e, por último, o primeiro início.
 */
export function catalogAuctionDate(
  stats: Pick<CatalogAuctionStats, "auctionStartsAt" | "firstStartsAt" | "firstEndsAt">,
): Date | null {
  return stats.auctionStartsAt ?? stats.firstEndsAt ?? stats.firstStartsAt;
}

/**
 * Leilões de uma aba: com pelo menos um lote no filtro e na situação pedida (aberto ou encerrado).
 * Abertos: o mais próximo primeiro. Encerrados: o mais recente primeiro. Sem data, por último.
 */
export function selectCatalogAuctions<T extends CatalogAuctionStats>(
  stats: readonly T[],
  ended: boolean,
): (T & CatalogAuctionState)[] {
  const direction = ended ? -1 : 1;
  return stats
    .map((item) => ({ ...item, date: catalogAuctionDate(item), isOpen: item.open > 0 }))
    .filter((item) => item.matching > 0 && item.isOpen !== ended)
    .sort((a, b) => {
      if (a.date === null || b.date === null) return a.date === b.date ? byKey(a, b) : a.date === null ? 1 : -1;
      return direction * (a.date.getTime() - b.date.getTime()) || byKey(a, b);
    });
}

/** Desempate estável: fonte e id. */
function byKey(a: CatalogAuctionStats, b: CatalogAuctionStats): number {
  return a.sourceId.localeCompare(b.sourceId) || a.externalId.localeCompare(b.externalId);
}
