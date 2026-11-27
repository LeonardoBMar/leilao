import { NextResponse } from "next/server";
import { z } from "zod";

import { apiEvaluateMarketQuerySchema, apiImportLotSchema } from "@/features/lots/import-schemas";
import { API_V1_HEADERS } from "@/server/api-auth";

/**
 * `GET /api/v1/openapi.json` (ARCHITECTURE §17, D-98):
 * Especificação OpenAPI 3.1.0 gerada automaticamente a partir dos schemas Zod (`z.toJSONSchema`).
 */

export function GET(): NextResponse {
  const importRequestSchema = z.toJSONSchema(apiImportLotSchema, { io: "input" });
  const evaluateQuerySchema = z.toJSONSchema(apiEvaluateMarketQuerySchema, { io: "input" });

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Leilão Tracker API",
      version: "1.0.0",
      description:
        "API JSON v1 (ARCHITECTURE §17). Valores monetários em centavos inteiros (`*Cents`), taxas em pontos-base (`*Bps`) e datas em ISO 8601 UTC.",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Access token emitido pelo Supabase Auth (cookies de sessão não são aceitos).",
        },
      },
      schemas: {
        ImportLotRequest: importRequestSchema,
        EvaluateMarketQuery: evaluateQuerySchema,
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/v1/lots/import": {
        post: {
          summary: "Importa um lote externo e cria rascunho v1 preenchido",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImportLotRequest" },
              },
            },
          },
          responses: {
            "201": { description: "Lote e rascunho criados com sucesso (inclui cabeçalho Location)." },
            "400": { description: "JSON malformado ou Content-Type inválido." },
            "401": { description: "Token Bearer ausente, inválido ou expirado." },
            "409": { description: "Número de lote duplicado no mesmo leilão." },
            "413": { description: "Corpo acima do limite de 64 KB." },
            "422": { description: "Falha de validação de campos." },
            "429": { description: "Limite de requisições por usuário atingido." },
          },
        },
      },
      "/api/v1/market/evaluate": {
        get: {
          summary: "Avalia a faixa histórica de arremate de um veículo",
          parameters: [
            { name: "brand", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 60 } },
            { name: "model", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 100 } },
            { name: "year", in: "query", required: true, schema: { type: "integer", minimum: 1950 } },
            {
              name: "damageLevel",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["small", "medium", "large", "salvage"] },
            },
            {
              name: "mileageKm",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 0, maximum: 2_000_000 },
            },
            {
              name: "fipeCents",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 500_000_000 },
            },
            { name: "isMotorcycle", in: "query", required: false, schema: { type: "string", enum: ["true", "false"] } },
          ],
          responses: {
            "200": { description: "Faixa histórica (P25, mediana, P75), tamanho da amostra e confiança." },
            "400": { description: "Parâmetros de consulta inválidos." },
            "401": { description: "Token Bearer ausente, inválido ou expirado." },
            "429": { description: "Limite de requisições por usuário atingido." },
          },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          summary: "Retorna esta especificação OpenAPI 3.1.0 gerada dos schemas Zod",
          security: [],
          responses: {
            "200": { description: "Documento OpenAPI 3.1.0." },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      ...API_V1_HEADERS,
      "Cache-Control": "public, max-age=300",
    },
  });
}
