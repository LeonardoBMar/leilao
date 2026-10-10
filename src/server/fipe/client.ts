import "server-only";

import { z } from "zod";

import {
  type FipeOption,
  type FipeTable,
  type FipeValue,
  type FipeVehicleType,
  parseFipeMonth,
} from "@/domain/listings/fipe-match";
import { parseBRL } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import type { FetchOutcome } from "@/sources/types";

import { createPoliteFetcher, DEADLINE_ERROR } from "../collector/http";
import { db } from "../db";
import { fipePriceFromResponse, recordFipePrices } from "./catalog";

/**
 * API pública da tabela FIPE (veiculos.fipe.org.br), a mesma que o site usa (D-47). Cada resposta fica guardada em
 * `fipe_responses`: tabela de mês passado não muda, então cada pedido é feito uma vez. A lista de tabelas muda todo
 * mês e é guardada por dia.
 */
export const FIPE_API_URL = "https://veiculos.fipe.org.br/api/veiculos";

/** Envia um formulário à API; o coletor entrega o acesso educado (intervalo, identificação, novas tentativas). */
export type FipePost = (url: string, form: Readonly<Record<string, string>>) => Promise<FetchOutcome>;

export type FipeClient = {
  tables: () => Promise<FipeTable[]>;
  brands: (table: FipeTable, type: FipeVehicleType) => Promise<FipeOption[]>;
  modelsByYear: (
    table: FipeTable,
    type: FipeVehicleType,
    brand: string,
    year: number,
    fuel: number,
  ) => Promise<FipeOption[]>;
  value: (
    table: FipeTable,
    type: FipeVehicleType,
    brand: string,
    model: string,
    year: number,
    fuel: number,
  ) => Promise<FipeValue | null>;
};

/** A FIPE fora do ar ou respondendo fora do formato: a tentativa não conta e o anúncio fica pendente. */
export class FipeUnavailableError extends Error {}

/** Limite de pedidos ou de tempo desta execução atingido: não é falha, o resto fica para a próxima. */
export class FipeBudgetError extends FipeUnavailableError {}

/**
 * Ritmo da FIPE: ela recusou com HTTP 429 depois de ~1.500 pedidos a 1 por segundo (09/10/2026). Um pedido a cada 3 s
 * e no máximo 300 por coleta (~3.600 por dia em 12 coletas); as respostas guardadas não contam.
 */
export const FIPE_MIN_INTERVAL_MS = 3_000;
export const FIPE_REQUESTS_PER_RUN = 300;

/** Acesso educado à FIPE com limite de pedidos e de tempo; passado um deles, `FipeBudgetError`. */
export function createFipeAccess({
  deadline = Number.POSITIVE_INFINITY,
  maxRequests = Number.POSITIVE_INFINITY,
}: { deadline?: number; maxRequests?: number } = {}) {
  const fetcher = createPoliteFetcher({ minIntervalMs: FIPE_MIN_INTERVAL_MS, deadline });
  const post: FipePost = async (url, form) => {
    if (fetcher.requests >= maxRequests) {
      throw new FipeBudgetError(`limite de ${maxRequests} pedidos à FIPE nesta execução`);
    }
    const outcome = await fetcher.post(url, form);
    if (!outcome.ok && outcome.error === DEADLINE_ERROR) throw new FipeBudgetError(DEADLINE_ERROR);
    return outcome;
  };
  return {
    post,
    get requests() {
      return fetcher.requests;
    },
  };
}

const optionsSchema = z.array(z.object({ Label: z.string(), Value: z.coerce.string() }));
const tablesSchema = z.array(z.object({ Codigo: z.coerce.string(), Mes: z.string() }));
const valueSchema = z.object({ Valor: z.string(), CodigoFipe: z.string() });
/** Combinação inexistente (ex.: marca sem modelos naquele ano): a FIPE responde `{"codigo": "0", "erro": "…"}`. */
const notFoundSchema = z.object({ erro: z.string() });

const VEHICLE_NAMES: Record<FipeVehicleType, string> = { 1: "carro", 2: "moto", 3: "caminhao" };

export function createFipeClient(post: FipePost, now: () => Date = () => new Date()): FipeClient {
  /** Pedido com memória no banco. `null` guardado: a FIPE disse que não existe. */
  async function cached<T>(
    key: string,
    method: string,
    form: Record<string, string>,
    read: (data: unknown) => T | null,
    /** Depois de guardar uma resposta nova (ex.: o valor também vai para o catálogo de preços). */
    onStored?: (data: unknown) => Promise<unknown>,
  ): Promise<T | null> {
    const stored = await db.fipeResponse.findUnique({ where: { key }, select: { payload: true } });
    if (stored) return read(stored.payload);
    const response = await post(`${FIPE_API_URL}/${method}`, form);
    if (!response.ok) throw new FipeUnavailableError(`FIPE ${method}: ${response.error}`);
    let data: unknown;
    try {
      data = JSON.parse(response.text);
    } catch {
      throw new FipeUnavailableError(`FIPE ${method}: resposta fora do formato`);
    }
    if (notFoundSchema.safeParse(data).success) data = null;
    else if (read(data) === null) throw new FipeUnavailableError(`FIPE ${method}: resposta fora do formato`);
    await db.fipeResponse.upsert({
      where: { key },
      create: { key, payload: toJson(data) },
      update: { payload: toJson(data), fetchedAt: now() },
    });
    if (data !== null) await onStored?.(data);
    return data === null ? null : read(data);
  }

  const options = (data: unknown) => {
    const parsed = optionsSchema.safeParse(data);
    return parsed.success ? parsed.data.map((item) => ({ code: item.Value, label: item.Label })) : null;
  };

  const base = (table: FipeTable, type: FipeVehicleType) => ({
    codigoTabelaReferencia: table.code,
    codigoTipoVeiculo: String(type),
  });

  return {
    async tables() {
      const day = now().toISOString().slice(0, 10);
      const list = await cached(`tabelas:${day}`, "ConsultarTabelaDeReferencia", {}, (data) => {
        const parsed = tablesSchema.safeParse(data);
        if (!parsed.success) return null;
        return parsed.data.flatMap((item) => {
          const month = parseFipeMonth(item.Mes);
          return month === null ? [] : [{ code: item.Codigo, month }];
        });
      });
      if (list === null || list.length === 0) throw new FipeUnavailableError("FIPE sem tabelas de referência");
      return list;
    },
    async brands(table, type) {
      return (await cached(`marcas:${table.code}:${type}`, "ConsultarMarcas", base(table, type), options)) ?? [];
    },
    async modelsByYear(table, type, brand, year, fuel) {
      const form = {
        ...base(table, type),
        codigoMarca: brand,
        ano: `${year}-${fuel}`,
        codigoTipoCombustivel: String(fuel),
        anoModelo: String(year),
      };
      const key = `modelos:${table.code}:${type}:${brand}:${year}-${fuel}`;
      return (await cached(key, "ConsultarModelosAtravesDoAno", form, options)) ?? [];
    },
    async value(table, type, brand, model, year, fuel) {
      const form = {
        ...base(table, type),
        codigoMarca: brand,
        codigoModelo: model,
        anoModelo: String(year),
        codigoTipoCombustivel: String(fuel),
        ano: `${year}-${fuel}`,
        tipoVeiculo: VEHICLE_NAMES[type],
        tipoConsulta: "tradicional",
      };
      const key = `valor:${table.code}:${type}:${brand}:${model}:${year}-${fuel}`;
      return cached(
        key,
        "ConsultarValorComTodosParametros",
        form,
        (data) => {
          const parsed = valueSchema.safeParse(data);
          const value = parsed.success ? parseBRL(parsed.data.Valor) : null;
          return parsed.success && value !== null ? { value, fipeCode: parsed.data.CodigoFipe } : null;
        },
        // Catálogo de preços (D-49): a resposta nova vira linha consultável.
        async (data) => {
          const row = fipePriceFromResponse(key, data);
          if (row) await recordFipePrices([row]);
        },
      );
    },
  };
}

/** `null` da FIPE ("não existe") é guardado como objeto, porque a coluna é NOT NULL; a leitura o trata como ausente. */
function toJson(value: unknown): Prisma.InputJsonValue {
  const parsed: unknown = value === null ? { notFound: true } : JSON.parse(JSON.stringify(value));
  return isJsonObjectOrArray(parsed) ? parsed : { notFound: true };
}

function isJsonObjectOrArray(value: unknown): value is Prisma.InputJsonObject | Prisma.InputJsonArray {
  return typeof value === "object" && value !== null;
}
