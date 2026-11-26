import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@/server/auth", () => ({
  requireUser: () => mockRequireUser(),
}));

vi.mock("@/server/db", () => ({
  db: {
    analysis: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
  isUniqueViolation: () => false,
}));

import { saveDraft } from "./mutations";
import type { AnalysisForm } from "./schemas";

const EMPTY_FORM: AnalysisForm = {
  intent: "draft",
  knownResultAtCreation: false,
};

describe("saveDraft (guarda otimista)", () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue({ id: "user-1" });
    mockUpdateMany.mockReset();
    mockFindFirst.mockReset();
  });

  it("grava e retorna o novo updatedAt quando expectedUpdatedAt coincide", async () => {
    const expected = new Date("2026-11-26T10:00:00.000Z");
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await saveDraft("analysis-1", EMPTY_FORM, expected);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.updatedAt).toBeInstanceOf(Date);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "analysis-1", ownerId: "user-1", status: "draft", updatedAt: expected }),
      }),
    );
  });

  it("retorna stale_draft quando um autosave atrasado encontra rascunho já atualizado", async () => {
    const expected = new Date("2026-11-26T10:00:00.000Z");
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindFirst.mockResolvedValueOnce({ id: "analysis-1" });

    const result = await saveDraft("analysis-1", EMPTY_FORM, expected);

    expect(result).toEqual({ ok: false, error: "stale_draft" });
  });

  it("retorna not_draft quando a análise já foi fixada", async () => {
    const expected = new Date("2026-11-26T10:00:00.000Z");
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "analysis-1" });

    const result = await saveDraft("analysis-1", EMPTY_FORM, expected);

    expect(result).toEqual({ ok: false, error: "not_draft" });
  });
});
