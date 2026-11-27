import { type NextRequest, NextResponse } from "next/server";

import { bps, cents } from "@/domain/money";
import { apiImportLotSchema } from "@/features/lots/import-schemas";
import { API_V1_HEADERS, apiError, authenticateBearerRequest } from "@/server/api-auth";
import { importExternalLotForOwner } from "@/server/import-lot";
import { checkUserRateLimit } from "@/server/rate-limit";

/**
 * `POST /api/v1/lots/import` (ARCHITECTURE §17, D-98):
 * Importa um lote estruturado via `Authorization: Bearer <token>`, cria leilão/lote/rascunho em transação
 * e devolve o lance máximo inicial e a faixa histórica de mercado.
 */

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_PER_MIN = 20;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateBearerRequest(request);
  if (!auth.ok) return auth.response;

  const limit = checkUserRateLimit(auth.user.id, "api:v1:lots:import", RATE_LIMIT_PER_MIN, 60_000);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Limite de requisições atingido. Aguarde antes de tentar novamente.", {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return apiError(400, "invalid_request", "Envie o corpo em application/json.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return apiError(413, "payload_too_large", "Corpo acima do limite de 64 KB.");
  }

  let rawBody: string;
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return apiError(413, "payload_too_large", "Corpo acima do limite de 64 KB.");
      }
      chunks.push(value);
    }
    rawBody = Buffer.concat(chunks).toString("utf8");
  } else {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return apiError(413, "payload_too_large", "Corpo acima do limite de 64 KB.");
    }
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return apiError(400, "invalid_request", "JSON malformado.");
  }

  const parsed = apiImportLotSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_root";
      const list = fieldErrors[key] ?? [];
      list.push(issue.message);
      fieldErrors[key] = list;
    }
    return apiError(422, "validation_failed", "Revise os campos destacados.", { fields: fieldErrors });
  }

  const body = parsed.data;
  try {
    const created = await importExternalLotForOwner(auth.user.id, {
      auctioneer: body.auctioneer,
      auctionName: body.auctionName ?? `${body.auctioneer} (API)`,
      lotNumber: body.lotNumber,
      brand: body.brand,
      model: body.model,
      vehicleVersion: body.vehicleVersion ?? null,
      manufactureYear: body.manufactureYear ?? null,
      modelYear: body.modelYear,
      mileageKm: body.mileageKm ?? null,
      fuel: body.fuel ?? null,
      damageLevel: body.damageLevel ?? null,
      isMotorcycle: body.isMotorcycle ?? false,
      currentBidCents: body.currentBidCents != null ? cents(body.currentBidCents) : null,
      commissionRateBps: body.commissionRateBps != null ? bps(body.commissionRateBps) : null,
      otherFeesCents: body.otherFeesCents != null ? cents(body.otherFeesCents) : null,
      fipeValueCents: body.fipeValueCents != null ? cents(body.fipeValueCents) : null,
      fipeRefMonth: null,
      city: body.city ?? null,
      state: body.state ?? null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      lotUrl: body.lotUrl ?? null,
      notes: body.notes ?? null,
    });

    if (!created.ok) {
      return apiError(409, "duplicate_lot_number", "Já existe um lote com este número neste leilão.");
    }

    return NextResponse.json(
      { data: created.value },
      {
        status: 201,
        headers: {
          ...API_V1_HEADERS,
          Location: `/lotes/${created.value.lotId}`,
        },
      },
    );
  } catch (error) {
    console.error("Erro em POST /api/v1/lots/import:", error instanceof Error ? error.message : "unknown");
    return apiError(500, "internal_error", "Não foi possível importar o lote agora.");
  }
}
