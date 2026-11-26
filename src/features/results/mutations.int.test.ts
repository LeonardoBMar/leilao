import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cents } from "@/domain/money";

const { currentUserId } = vi.hoisted(() => ({ currentUserId: { value: "" } }));

vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: currentUserId.value, email: "int@example.com" }),
}));

/**
 * Testes de integração de imutabilidade e revisões (`npm run test:int`, requer `DB_INT_TESTS=1`).
 * Atenção: análises fixadas e revisões de resultado são imutáveis por trigger no Postgres; rode apenas em banco
 * de testes dedicado.
 */
describe.skipIf(process.env.DB_INT_TESTS !== "1")(
  "DAL: imutabilidade de análises fixadas e revisões de resultado",
  () => {
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

    it("impede edição/descarte de análise fixada e detecta revisão stale em recordResult", async () => {
      const auctionsMut = await import("@/features/auctions/mutations");
      const lotsMut = await import("@/features/lots/mutations");
      const analysesMut = await import("@/features/analyses/mutations");
      const resultsMut = await import("./mutations");

      const { id: auctionId } = await auctionsMut.createAuction({
        name: "Leilão Imutabilidade INT",
        auctioneer: "Leiloeiro Teste",
        origin: "detran",
        status: "in_progress",
        startsAt: new Date("2026-11-20T14:00:00Z"),
      });
      const createdLot = await lotsMut.createLot(auctionId, {
        lotNumber: "IMM-001",
        brand: "FIAT",
        model: "ARGO",
        modelYear: 2022,
        isFollowed: true,
      });
      expect(createdLot.ok).toBe(true);
      if (!createdLot.ok) return;
      const lotId = createdLot.value.id;

      const draft = await analysesMut.createDraft(lotId);
      expect(draft.ok).toBe(true);
      if (!draft.ok) return;

      const completeForm = {
        marketValue: cents(6_000_000),
        repairCost: cents(300_000),
        documentationCost: cents(150_000),
        transportCost: cents(100_000),
        tiresCost: cents(0),
        serviceCost: cents(100_000),
        otherFees: cents(50_000),
        debtsCost: cents(0),
        sellingCost: cents(0),
        taxCost: cents(0),
        commissionMode: "percentage" as const,
        commissionRateBps: 500,
        riskReserveRateBps: 500,
        desiredMarginRateBps: 1500,
        knownResultAtCreation: false,
        intent: "fix" as const,
      };

      const fixed = await analysesMut.fixAnalysis(draft.value.id, completeForm);
      expect(fixed).toEqual({ ok: true, value: null });

      // Análise fixada não pode mais ser salva nem descartada.
      expect(await analysesMut.saveDraft(draft.value.id, { ...completeForm, intent: "draft" })).toEqual({
        ok: false,
        error: "not_draft",
      });
      expect(await analysesMut.discardDraft(draft.value.id)).toEqual({ ok: false, error: "not_draft" });

      // Lote com análise fixada não pode ser excluído definitivamente.
      expect(await lotsMut.deleteLot(lotId)).toEqual({ ok: false, error: "has_history" });

      // Revisão 1 do resultado e detecção de revisão obsoleta (`stale`).
      const rev1 = await resultsMut.recordResult(lotId, {
        outcome: "sold",
        finalBid: cents(3_500_000),
        personalOutcome: "observed",
        analysisId: draft.value.id,
        baseRevision: 0,
      });
      expect(rev1).toEqual({ ok: true, value: null });

      const stale = await resultsMut.recordResult(lotId, {
        outcome: "unsold",
        personalOutcome: "observed",
        baseRevision: 0,
      });
      expect(stale).toEqual({ ok: false, error: "stale" });

      // Outro dono não consegue gravar revisão no lote de ownerA.
      currentUserId.value = ownerB;
      const foreign = await resultsMut.recordResult(lotId, {
        outcome: "unsold",
        personalOutcome: "observed",
        baseRevision: 1,
      });
      expect(foreign).toEqual({ ok: false, error: "lot_not_found" });
    }, 30_000);
  },
);
