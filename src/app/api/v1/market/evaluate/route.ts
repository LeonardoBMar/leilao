import { type NextRequest, NextResponse } from "next/server";

import { estimatePrice } from "@/domain/listings/estimates";
import { apiEvaluateMarketQuerySchema } from "@/features/lots/import-schemas";
import { API_V1_HEADERS, apiError, authenticateBearerRequest } from "@/server/api-auth";
import { lookupVehicleFipe } from "@/server/fipe/lookup";
import { getRecentEstimateIndex } from "@/server/market/sold-sales";
import { checkUserRateLimit } from "@/server/rate-limit";

/**
 * `GET /api/v1/market/evaluate` (ARCHITECTURE §17, D-98):
 * Consulta a faixa típica de arremate, mediana, amostra e confiança de um veículo no catálogo histórico.
 */

const RATE_LIMIT_PER_MIN = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateBearerRequest(request);
  if (!auth.ok) return auth.response;

  const limit = checkUserRateLimit(auth.user.id, "api:v1:market:evaluate", RATE_LIMIT_PER_MIN, 60_000);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Limite de requisições atingido. Aguarde antes de tentar novamente.", {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = apiEvaluateMarketQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return apiError(400, "invalid_request", "Parâmetros de consulta inválidos.");
  }

  const query = parsed.data;
  try {
    const [index, fipe] = await Promise.all([
      getRecentEstimateIndex(),
      query.fipeCents === undefined
        ? lookupVehicleFipe({
            brand: query.brand,
            model: query.model,
            modelYear: query.year,
            isMotorcycle: query.isMotorcycle ?? false,
          })
        : Promise.resolve(null),
    ]);

    const marketValue = query.fipeCents ?? fipe?.value ?? null;
    const result = estimatePrice(
      {
        brand: query.brand,
        model: query.model,
        modelYear: query.year,
        mileageKm: query.mileageKm ?? null,
        category: query.isMotorcycle ? "Motos" : "Carros",
        damageLevel: query.damageLevel ?? null,
        fipeCode: fipe?.fipeCode ?? null,
        origin: null,
        marketValue,
      },
      index,
    );

    if (result.kind === "comparables" || result.kind === "market_ratio") {
      return NextResponse.json(
        {
          data: {
            kind: result.kind,
            lowCents: result.low,
            medianCents: result.median,
            highCents: result.high,
            sampleSize: result.n,
            confidence: result.confidence,
            fipeCents: marketValue,
          },
        },
        { headers: API_V1_HEADERS },
      );
    }

    return NextResponse.json(
      {
        data: {
          kind: "insufficient",
          lowCents: null,
          medianCents: null,
          highCents: null,
          sampleSize: result.comparables,
          confidence: null,
          fipeCents: marketValue,
        },
      },
      { headers: API_V1_HEADERS },
    );
  } catch (error) {
    console.error("Erro em GET /api/v1/market/evaluate:", error instanceof Error ? error.message : "unknown");
    return apiError(500, "internal_error", "Não foi possível avaliar o veículo agora.");
  }
}
