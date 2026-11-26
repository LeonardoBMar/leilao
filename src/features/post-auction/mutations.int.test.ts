import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cents } from "@/domain/money";

const { currentUserId } = vi.hoisted(() => ({ currentUserId: { value: "" } }));

vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: currentUserId.value, email: "int@example.com" }),
}));

/**
 * Testes de integração do módulo Pós-Arremate (`npm run test:int`, requer `DB_INT_TESTS=1`).
 * Valida transação atômica de despesas, isolamento por `ownerId`, limpeza de venda ao sair de `sold`
 * e bloqueio quando a revisão vigente do resultado deixa de ser `won`.
 */
describe.skipIf(process.env.DB_INT_TESTS !== "1")("DAL: pós-arremate, despesas reais e isolamento por dono", () => {
  const ownerA = crypto.randomUUID();
  const ownerB = crypto.randomUUID();

  beforeEach(() => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    currentUserId.value = ownerA;
  });

  afterAll(async () => {
    const { disconnectDb } = await import("@/server/disconnect");
    await disconnectDb();
  });

  it("exige resultado arrematado, isola por dono e garante consistência transacional", async () => {
    const auctionsMut = await import("@/features/auctions/mutations");
    const lotsMut = await import("@/features/lots/mutations");
    const resultsMut = await import("@/features/results/mutations");
    const postAuctionMut = await import("./mutations");
    const postAuctionQueries = await import("./queries");

    const { id: auctionId } = await auctionsMut.createAuction({
      name: "Leilão Pós-Arremate INT",
      auctioneer: "Leiloeiro Teste",
      origin: "detran",
      status: "in_progress",
      startsAt: new Date("2026-11-20T14:00:00Z"),
    });
    const createdLot = await lotsMut.createLot(auctionId, {
      lotNumber: "PA-001",
      brand: "VW",
      model: "POLO",
      modelYear: 2023,
      isFollowed: true,
    });
    expect(createdLot.ok).toBe(true);
    if (!createdLot.ok) return;
    const lotId = createdLot.value.id;

    // Antes de arrematar, o pós-arremate é bloqueado com `not_won`.
    expect(await postAuctionQueries.getLotPostAuctionContext(lotId)).toBeNull();
    expect(
      await postAuctionMut.upsertPostAuction(lotId, {
        status: "acquired",
      }),
    ).toEqual({ ok: false, error: "not_won" });
    expect(
      await postAuctionMut.addLotExpense(lotId, {
        category: "repair",
        description: "Funilaria inicial",
        amount: cents(150_000),
        incurredAt: new Date("2026-11-21T00:00:00Z"),
      }),
    ).toEqual({ ok: false, error: "not_won" });

    // Registra arremate (`personalOutcome = "won"`).
    const wonRev = await resultsMut.recordResult(lotId, {
      outcome: "sold",
      finalBid: cents(3_000_000),
      personalOutcome: "won",
      baseRevision: 0,
    });
    expect(wonRev).toEqual({ ok: true, value: null });

    // `addLotExpense` cria `lot_post_auctions` e a despesa na mesma transação.
    const expense = await postAuctionMut.addLotExpense(lotId, {
      category: "repair",
      description: "Funilaria porta",
      amount: cents(200_000),
      incurredAt: new Date("2026-11-21T00:00:00Z"),
    });
    expect(expense.ok).toBe(true);
    if (!expense.ok) return;

    const afterExpense = await postAuctionQueries.getLotPostAuctionContext(lotId);
    expect(afterExpense).not.toBeNull();
    expect(afterExpense?.record.status).toBe("acquired");
    expect(afterExpense?.pnl.totalExpenses).toBe(cents(200_000));
    expect(afterExpense?.pnl.totalInvested).toBe(cents(3_200_000));

    // Marca como vendido e depois volta para anunciado — `soldAt` e `salePrice` devem ser limpos.
    const sold = await postAuctionMut.upsertPostAuction(lotId, {
      status: "sold",
      soldAt: new Date("2026-11-25T00:00:00Z"),
      salePrice: cents(4_000_000),
      privatePlate: "ABC1D23",
    });
    expect(sold.ok).toBe(true);

    const soldContext = await postAuctionQueries.getLotPostAuctionContext(lotId);
    expect(soldContext?.pnl.realizedProfit).toBe(cents(800_000));

    const revertedToListed = await postAuctionMut.upsertPostAuction(lotId, {
      status: "listed",
      soldAt: new Date("2026-11-25T00:00:00Z"),
      salePrice: cents(4_000_000),
    });
    expect(revertedToListed.ok).toBe(true);

    const listedContext = await postAuctionQueries.getLotPostAuctionContext(lotId);
    expect(listedContext?.record.soldAt).toBeNull();
    expect(listedContext?.record.salePrice).toBeNull();
    expect(listedContext?.pnl.realizedProfit).toBeNull();

    // Isolamento por dono: ownerB não lê nem altera pós-arremate ou despesa de ownerA.
    currentUserId.value = ownerB;
    expect(await postAuctionQueries.getLotPostAuctionContext(lotId)).toBeNull();
    expect(await postAuctionMut.upsertPostAuction(lotId, { status: "in_repair" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(
      await postAuctionMut.addLotExpense(lotId, {
        category: "other",
        description: "Tentativa indevida",
        amount: cents(10_000),
        incurredAt: new Date("2026-11-22T00:00:00Z"),
      }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(await postAuctionMut.deleteLotExpense(lotId, expense.value.id)).toEqual({
      ok: false,
      error: "not_found",
    });

    // ownerA remove a despesa com sucesso; segunda remoção retorna `not_found`.
    currentUserId.value = ownerA;
    expect(await postAuctionMut.deleteLotExpense(lotId, expense.value.id)).toEqual({ ok: true, value: undefined });
    expect(await postAuctionMut.deleteLotExpense(lotId, expense.value.id)).toEqual({
      ok: false,
      error: "not_found",
    });

    // Ao corrigir o resultado de `won` para `bid_not_won`, o pós-arremate volta a bloquear escrita/leitura.
    const corrected = await resultsMut.recordResult(lotId, {
      outcome: "sold",
      finalBid: cents(3_100_000),
      personalOutcome: "bid_not_won",
      correctionReason: "Outro arrematante cobriu o lance",
      baseRevision: 1,
    });
    expect(corrected).toEqual({ ok: true, value: null });
    expect(await postAuctionQueries.getLotPostAuctionContext(lotId)).toBeNull();
    expect(await postAuctionMut.upsertPostAuction(lotId, { status: "in_repair" })).toEqual({
      ok: false,
      error: "not_won",
    });
  }, 30_000);
});
