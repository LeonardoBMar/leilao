import { describe, expect, it } from "vitest";

import { catalogAuctionDate, type CatalogAuctionStats, selectCatalogAuctions } from "./catalog-auctions";

const day = (date: string) => new Date(`${date}T12:00:00Z`);

function stats(overrides: Partial<CatalogAuctionStats> & { externalId: string }): CatalogAuctionStats {
  return {
    sourceId: "leilo",
    name: "Leilão",
    auctionStartsAt: null,
    firstStartsAt: null,
    firstEndsAt: null,
    total: 10,
    open: 5,
    matching: 3,
    analyzed: 0,
    ...overrides,
  };
}

describe("catalogAuctionDate", () => {
  it("usa a data da fonte quando existe", () => {
    expect(
      catalogAuctionDate({
        auctionStartsAt: day("2026-10-13"),
        firstStartsAt: day("2026-10-10"),
        firstEndsAt: day("2026-10-14"),
      }),
    ).toEqual(day("2026-10-13"));
  });

  it("sem data da fonte (Pátio), usa o primeiro encerramento, não a abertura dos lances", () => {
    expect(
      catalogAuctionDate({ auctionStartsAt: null, firstStartsAt: day("2026-10-05"), firstEndsAt: day("2026-10-08") }),
    ).toEqual(day("2026-10-08"));
    expect(catalogAuctionDate({ auctionStartsAt: null, firstStartsAt: day("2026-10-05"), firstEndsAt: null })).toEqual(
      day("2026-10-05"),
    );
    expect(catalogAuctionDate({ auctionStartsAt: null, firstStartsAt: null, firstEndsAt: null })).toBeNull();
  });
});

describe("selectCatalogAuctions", () => {
  const items = [
    stats({ externalId: "a", auctionStartsAt: day("2026-10-13") }),
    stats({ externalId: "b", auctionStartsAt: day("2026-10-09") }),
    stats({ externalId: "c" }),
    stats({ externalId: "d", auctionStartsAt: day("2026-09-28"), open: 0 }),
    stats({ externalId: "e", auctionStartsAt: day("2026-10-06"), open: 0 }),
    stats({ externalId: "f", auctionStartsAt: day("2026-10-07"), matching: 0 }),
  ];
  const ids = (ended: boolean) => selectCatalogAuctions(items, ended).map((item) => item.externalId);

  it("abertos: só com lote aberto, o mais próximo primeiro e sem data por último", () => {
    expect(ids(false)).toEqual(["b", "a", "c"]);
  });

  it("encerrados: sem lote aberto, o mais recente primeiro", () => {
    expect(ids(true)).toEqual(["e", "d"]);
  });

  it("leilão sem lote no filtro não aparece", () => {
    expect([...ids(false), ...ids(true)]).not.toContain("f");
  });

  it("traz a data e a situação calculadas", () => {
    expect(selectCatalogAuctions(items, false)[0]).toMatchObject({ date: day("2026-10-09"), isOpen: true });
  });
});
