import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cents } from "@/domain/money";

const { currentUserId } = vi.hoisted(() => ({ currentUserId: { value: "" } }));

vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: currentUserId.value, email: "int@example.com" }),
}));

/**
 * Testes de integração da DAL contra PostgreSQL (`npm run test:int`, requer `DB_INT_TESTS=1`).
 * Valida isolamento por `ownerId`, unicidade (`P2002`) e idempotência de rascunho único por lote.
 * Usa dois UUIDs sintéticos e remove tudo no fim via mutations da própria DAL.
 */
describe.skipIf(process.env.DB_INT_TESTS !== "1")("DAL: isolamento de dono e unicidade", () => {
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

  it("isola leitura, atualização e exclusão de leilões, lotes e rascunhos por ownerId", async () => {
    const auctionsMut = await import("./mutations");
    const auctionsQuery = await import("./queries");
    const lotsMut = await import("@/features/lots/mutations");
    const lotsQuery = await import("@/features/lots/queries");
    const analysesMut = await import("@/features/analyses/mutations");

    const auctionInput = {
      name: "Leilão Teste Integração",
      auctioneer: "Leiloeiro Teste",
      origin: "detran" as const,
      status: "scheduled" as const,
      startsAt: new Date("2026-12-10T14:00:00Z"),
    };
    const { id: auctionId } = await auctionsMut.createAuction(auctionInput);

    try {
      const lotInput = {
        lotNumber: "INT-001",
        brand: "VW",
        model: "GOL",
        modelYear: 2021,
        isFollowed: false,
        startingBid: cents(1_500_000),
      };
      const createdLot = await lotsMut.createLot(auctionId, lotInput);
      expect(createdLot.ok).toBe(true);
      if (!createdLot.ok) return;
      const lotId = createdLot.value.id;

      // Número de lote repetido no mesmo leilão deve bater no índice único (`P2002`).
      const duplicate = await lotsMut.createLot(auctionId, lotInput);
      expect(duplicate).toEqual({ ok: false, error: "duplicate_lot_number" });

      // Exclusão de leilão com lote vinculado é barrada.
      expect(await auctionsMut.deleteAuction(auctionId)).toEqual({ ok: false, error: "has_lots" });

      // Rascunho único por lote: chamadas repetidas devolvem o mesmo rascunho.
      const draft1 = await analysesMut.createDraft(lotId);
      const draft2 = await analysesMut.createDraft(lotId);
      expect(draft1.ok).toBe(true);
      expect(draft2).toEqual(draft1);

      // Outro usuário não enxerga nem altera leilão, lote ou rascunho de ownerA.
      currentUserId.value = ownerB;
      expect(await auctionsQuery.getAuction(auctionId)).toBeNull();
      expect(await auctionsMut.updateAuction(auctionId, auctionInput)).toEqual({ ok: false, error: "not_found" });
      expect(await auctionsMut.deleteAuction(auctionId)).toEqual({ ok: false, error: "not_found" });
      expect(await lotsQuery.getLot(lotId)).toBeNull();
      expect(await lotsMut.deleteLot(lotId)).toEqual({ ok: false, error: "not_found" });
      if (draft1.ok) {
        expect(await analysesMut.discardDraft(draft1.value.id)).toEqual({ ok: false, error: "not_found" });
      }

      // Limpeza como ownerA.
      currentUserId.value = ownerA;
      expect(await lotsMut.deleteLot(lotId)).toEqual({ ok: true, value: { auctionId } });
    } finally {
      currentUserId.value = ownerA;
      await auctionsMut.deleteAuction(auctionId);
    }
  }, 30_000);
});
