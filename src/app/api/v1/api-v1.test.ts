import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildEstimateIndex } from "@/domain/listings/estimates";
import { cents } from "@/domain/money";
import type * as ApiAuthModule from "@/server/api-auth";

const mockAuthenticateBearer = vi.fn();
const mockImportExternalLotForOwner = vi.fn();
const mockGetRecentEstimateIndex = vi.fn();
const mockLookupVehicleFipe = vi.fn();

vi.mock("@/lib/public-env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  },
}));

vi.mock("@/server/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof ApiAuthModule>();
  return {
    ...actual,
    authenticateBearerRequest: (req: NextRequest) => mockAuthenticateBearer(req),
  };
});

vi.mock("@/server/import-lot", () => ({
  importExternalLotForOwner: (...args: unknown[]) => mockImportExternalLotForOwner(...args),
}));

vi.mock("@/server/market/sold-sales", () => ({
  getRecentEstimateIndex: () => mockGetRecentEstimateIndex(),
}));

vi.mock("@/server/fipe/lookup", () => ({
  lookupVehicleFipe: (...args: unknown[]) => mockLookupVehicleFipe(...args),
}));

import { POST as postImportLot } from "./lots/import/route";
import { GET as getEvaluateMarket } from "./market/evaluate/route";
import { GET as getOpenApi } from "./openapi.json/route";

describe("API v1 contract tests (ARCHITECTURE §17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateBearer.mockResolvedValue({
      ok: true,
      user: { id: crypto.randomUUID(), email: "api@example.com" },
    });
    mockLookupVehicleFipe.mockResolvedValue(null);
    mockGetRecentEstimateIndex.mockResolvedValue(buildEstimateIndex([]));
  });

  it("POST /api/v1/lots/import exige JSON, valida campos (422), trata duplicidade (409) e cria lote (201 + Location)", async () => {
    // 400 sem Content-Type JSON
    const badCt = await postImportLot(
      new NextRequest("http://localhost/api/v1/lots/import", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "abc",
      }),
    );
    expect(badCt.status).toBe(400);
    expect((await badCt.json()).error.code).toBe("invalid_request");

    // 422 com lotUrl javascript: (anti-XSS)
    const xss = await postImportLot(
      new NextRequest("http://localhost/api/v1/lots/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auctioneer: "Copart",
          lotNumber: "123",
          brand: "TOYOTA",
          model: "COROLLA",
          modelYear: 2022,
          lotUrl: "javascript:alert(1)",
        }),
      }),
    );
    expect(xss.status).toBe(422);
    const xssBody = await xss.json();
    expect(xssBody.error.code).toBe("validation_failed");
    expect(xssBody.error.fields.lotUrl).toBeDefined();

    // 413 payload > 64 KB
    const huge = await postImportLot(
      new NextRequest("http://localhost/api/v1/lots/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(70_000),
      }),
    );
    expect(huge.status).toBe(413);
    expect((await huge.json()).error.code).toBe("payload_too_large");

    // 201 Created + Location + isolamento por ownerId
    const ownerId = crypto.randomUUID();
    mockAuthenticateBearer.mockResolvedValue({ ok: true, user: { id: ownerId, email: "api@example.com" } });
    mockImportExternalLotForOwner.mockResolvedValue({
      ok: true,
      value: {
        auctionId: "auc-1",
        lotId: "lot-1",
        analysisId: "ana-1",
        maxBidCents: cents(4_500_000),
        isViable: true,
        fipeCents: cents(7_000_000),
        marketBand: null,
      },
    });

    const okRes = await postImportLot(
      new NextRequest("http://localhost/api/v1/lots/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auctioneer: "Copart Brasil",
          lotNumber: "984512",
          brand: "TOYOTA",
          model: "COROLLA",
          modelYear: 2022,
          lotUrl: "https://www.copart.com.br/lot/984512",
        }),
      }),
    );
    expect(okRes.status).toBe(201);
    expect(okRes.headers.get("location")).toBe("/lotes/lot-1");
    expect(mockImportExternalLotForOwner).toHaveBeenCalledWith(
      ownerId,
      expect.objectContaining({ brand: "TOYOTA", lotNumber: "984512" }),
    );
    expect((await okRes.json()).data.lotId).toBe("lot-1");

    // 409 duplicate_lot_number
    mockImportExternalLotForOwner.mockResolvedValue({ ok: false, error: "duplicate_lot_number" });
    const dupRes = await postImportLot(
      new NextRequest("http://localhost/api/v1/lots/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auctioneer: "Copart Brasil",
          lotNumber: "984512",
          brand: "TOYOTA",
          model: "COROLLA",
          modelYear: 2022,
        }),
      }),
    );
    expect(dupRes.status).toBe(409);
    expect((await dupRes.json()).error.code).toBe("duplicate_lot_number");
  });

  it("GET /api/v1/market/evaluate retorna 400 para query inválida e 200 com envelope { data }", async () => {
    const bad = await getEvaluateMarket(new NextRequest("http://localhost/api/v1/market/evaluate?brand=TOYOTA"));
    expect(bad.status).toBe(400);
    const badBody = await bad.json();
    expect(badBody.error.code).toBe("invalid_request");
    expect(badBody.error.fields).toBeUndefined();

    const ok = await getEvaluateMarket(
      new NextRequest("http://localhost/api/v1/market/evaluate?brand=TOYOTA&model=COROLLA&year=2022"),
    );
    expect(ok.status).toBe(200);
    const okBody = await ok.json();
    expect(okBody.data.kind).toBe("insufficient");
  });

  it("GET /api/v1/openapi.json devolve documento OpenAPI 3.1.0 válido com esquemas gerados", async () => {
    const res = getOpenApi();
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/v1/lots/import"]).toBeDefined();
    expect(spec.paths["/api/v1/market/evaluate"]).toBeDefined();
    expect(spec.components.schemas.ImportLotRequest).toBeDefined();
  });
});
